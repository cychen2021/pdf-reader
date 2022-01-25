'use strict';

import React from 'react';
import ReactDom from 'react-dom';
import { IntlProvider } from 'react-intl';
import Annotator from './components/annotator';
import AnnotationsStore from './annotations-store';
import { debounce } from './lib/debounce';
import { Extractor } from './lib/extract';

class Viewer {
	constructor(options) {
		this.options = options;
		this._loaded = false;
		this._onSetState = debounce(function (state) {
			options.onSetState(state);
		}, 100);
		this._userID = options.userID;
		this._label = options.label;
		this._lastState = null;
		this._uninitialized = false;
		// TODO: Find a better way to determine the event origin
		this._enableSidebarOpenEvent = true;
		this.setBottomPlaceholderHeight(this.options.bottomPlaceholderHeight);
		this._annotatorPromise = new Promise((resolve) => {
			this._annotatorPromiseResolve = resolve;
		});
		this._pdfjsPromise = new Promise((resolve) => {
			this._pdfjsPromiseResolve = resolve;
		});
		this._annotationsStore = new AnnotationsStore({
			readOnly: options.readOnly,
			authorName: options.authorName,
			annotations: options.annotations,
			onSave: options.onSaveAnnotations,
			onDelete: options.onDeleteAnnotations,
			onRender: (annotations) => {
				this.annotatorRef.current.setAnnotations([...annotations]);
			}
		});

		window.pageTextPositions = {};

		this._initSelectionBox();
		this._applyExtraLocalizations();

		// Takeover the download button
		PDFViewerApplication.download = function () {
		};

		// Sidebar configuration must be finished before loading the PDF
		// to avoid the immediate resize and re-render of PDF pages
		if (this.options.sidebarOpen) {
			PDFViewerApplication.pdfSidebar.setInitialView(9);
		}
		else {
			PDFViewerApplication.pdfSidebar.switchView(9);
		}
		window.PDFViewerApplication.pdfSidebarResizer._updateWidth(this.options.sidebarWidth);

		document.getElementById('download').addEventListener('click', this.handleDownloadButtonClick);
		document.getElementById('zoomAuto').addEventListener('click', this.handleZoomAutoButtonClick);
		window.PDFViewerApplication.eventBus.on('pagerendered', this.handlePageRender);
		window.PDFViewerApplication.eventBus.on('updateviewarea', this.handleViewAreaUpdate);
		window.PDFViewerApplication.eventBus.on('documentinit', this.handleDocumentInit);
		window.onChangeSidebarWidth = this.handleChangeSidebarWidth;
		// document.getElementById('back').addEventListener('click', this.handleBackButtonClick);
		// document.getElementById('forward').addEventListener('click', this.handleForwardButtonClick);
		// Override the external link click handling
		window.addEventListener('click', this.handleClick, true);
		// Prevent dragging for internal links
		window.addEventListener('dragstart', this.handleDragStart);

		// window.PDFViewerApplication.eventBus.on("pagesinit", () => {
		//   window.PDFViewerApplication.pdfDocument._transport.messageHandler.sendWithPromise("setIgnoredAnnotationIDs", options.ignoredAnnotationIDs);
		// });

		window.PDFViewerApplication.eventBus.on('pagesinit', () => {
			this._pdfjsPromiseResolve();

			// For development purposes only, when dropping various test files to the same window
			window.extractor = new Extractor(window.PDFViewerApplication.pdfViewer);
		});

		window.extractor = new Extractor(window.PDFViewerApplication.pdfViewer);

		this.annotatorRef = React.createRef();
		this.node = document.createElement('div');
		ReactDom.render(
			<IntlProvider
				locale={window.navigator.language}
				messages={this.options.localizedStrings}
				onError={window.development && (() => {
				})}
			>
				<Annotator
					readOnly={options.readOnly}
					onAddAnnotation={this._annotationsStore.addAnnotation.bind(this._annotationsStore)}
					onUpdateAnnotations={this._annotationsStore.updateAnnotations.bind(this._annotationsStore)}
					onDeleteAnnotations={this._annotationsStore.deleteAnnotations.bind(this._annotationsStore)}
					onClickTags={options.onClickTags}
					onDoubleClickPageLabel={options.onDoubleClickPageLabel}
					onPopup={options.onPopup}
					onClosePopup={options.onClosePopup}
					onAddToNote={options.onAddToNote}
					ref={this.annotatorRef}
				/>
			</IntlProvider>,
			this.node,
			() => {
				this._annotationsStore.render();
				this._annotatorPromiseResolve();
			}
		);

		setTimeout(function () {
			window.PDFViewerApplication.open(options.buf);
		}, 0);
	}

	uninit() {
		window.PDFViewerApplication.pdfDocument.uninitialized = true;
		ReactDom.unmountComponentAtNode(this.node);
		document.getElementById('download').removeEventListener('click', this.handleDownloadButtonClick);
		document.getElementById('zoomAuto').removeEventListener('click', this.handleZoomAutoButtonClick);
		window.PDFViewerApplication.eventBus.off('pagerendered', this.handlePageRender);
		window.PDFViewerApplication.eventBus.off('updateviewarea', this.handleViewAreaUpdate);
		window.PDFViewerApplication.eventBus.off('sidebarviewchanged', this.handleSidebarViewChange);
		window.PDFViewerApplication.eventBus.off('documentinit', this.handleDocumentInit);
		// document.getElementById('back').removeEventListener('click', this.handleBackButtonClick);
		// document.getElementById('forward').removeEventListener('click', this.handleForwardButtonClick);
		window.removeEventListener('click', this.handleClick);
		window.removeEventListener('dragstart', this.handleDragStart);
		window.PDFViewerApplication.close();
		this._uninitialized = true;
		window.extractor.charsCache = {};
	}

	_initSelectionBox() {
		let box = document.createElement('textarea');
		box.tabIndex = -1;
		box.style = 'position: absolute;top: 0;left: 0;width: 0;height: 0;z-index: -1;pointer-events: none;';
		document.body.append(box);
		window.selectionBox = box;
	}

	_getLocalizedString(key) {
		let string = this.options.localizedStrings[key];
		return string || key;
	}

	_applyExtraLocalizations() {
		document.getElementById('zoomAuto').setAttribute('title', this._getLocalizedString('pdfReader.zoomPageWidth'));
		document.getElementById('viewAnnotations').setAttribute('title', this._getLocalizedString('pdfReader.showAnnotations'));
	}

	handleDownloadButtonClick = () => {
		this.options.onDownload();
	}

	handleZoomAutoButtonClick = () => {
		PDFViewerApplication.pdfViewer.currentScaleValue = 'page-width';
	}

	handlePageRender = async (event) => {
		// Extract all text rects that will be used for showing text cursor
		let pageIndex = event.pageNumber - 1;
		let position = { pageIndex, rects: [] };
		await window.extractor.getPageChars(pageIndex);
		let selectionRange = window.extractor.extractRange({ pageIndex });
		if (selectionRange) {
			position = selectionRange.position;
		}
		window.pageTextPositions[pageIndex] = position;
	}

	handleViewAreaUpdate = (e) => {
		let state = {
			pageIndex: e.location.pageNumber - 1,
			scale: e.location.scale,
			rotation: e.location.rotation,
			top: e.location.top,
			left: e.location.left,
			sidebarView: window.PDFViewerApplication.pdfSidebar.isOpen
				? window.PDFViewerApplication.pdfSidebar.active
				: 0,
			sidebarWidth: window.PDFViewerApplication.pdfSidebarResizer._width || 200,
			scrollMode: PDFViewerApplication.pdfViewer.scrollMode,
			spreadMode: PDFViewerApplication.pdfViewer.spreadMode
		};
		this._lastState = state;
		this._onSetState(state);
	}

	handleSidebarViewChange = (e) => {
		if (this._lastState) {
			this._lastState.sidebarView = e.view;
			this._onSetState(this._lastState);
		}
		// Without this context pane in stacked mode is hidden on first tab open
		setTimeout(() => {
			PDFViewerApplication.eventBus.dispatch('resize');
		}, 50);
		if (this._enableSidebarOpenEvent) {
			this.options.onChangeSidebarOpen(!!e.view);
		}
	}

	handleDocumentInit = async () => {
		// PDFViewerApplication.pdfSidebar.switchView(9);


		if (this.options.state) {
			this._setState(this.options.state, !!this.options.location);
		}
		// Default state
		else {
			PDFViewerApplication.pdfViewer.currentScaleValue = 'page-width';
		}

		await this._annotatorPromise;
		if (this._uninitialized) {
			return;
		}

		if (this.options.location) {
			this.annotatorRef.current.navigate(this.options.location);
		}

		// Can't be in the constructor because gets triggered by the initial
		// sidebar configuration
		window.PDFViewerApplication.eventBus.on('sidebarviewchanged', this.handleSidebarViewChange);
	}

	handleChangeSidebarWidth = (width) => {
		this.options.onChangeSidebarWidth(width);
	}

	handleClick = (event) => {
		if (
			event.button === 0
			// On FF target is document node when mouseup is outside of pdf-reader
			&& event.target.nodeType === Node.ELEMENT_NODE
			&& event.target.closest('.annotationLayer')
			&& !event.target.classList.contains('internalLink')
		) {
			event.preventDefault();
			event.stopPropagation();
			if (!PDFViewerApplication.pdfViewer.isInPresentationMode
				&& event.target.href) {
				this.options.onExternalLink(event.target.href);
			}
		}
	}

	handleDragStart = (event) => {
		if (event.target.nodeType === Node.ELEMENT_NODE
			&& (event.target.closest('.annotationLayer')
				|| !event.target.closest('#viewer')
				&& !event.target.closest('#annotationsView')
			)) {
			event.preventDefault();
		}
	}

	setColor = (color) => {
		this.annotatorRef.current.setColor(color);
	};

	openPageLabelPopup = (data) => {
		this.annotatorRef.current.openPageLabelPopup(data);
	};

	editHighlightedText = (data) => {
		this.annotatorRef.current.editHighlightedText(data);
	};

	clearSelector = () => {
		this.annotatorRef.current.clearSelector();
	};

	navigate = async (location) => {
		await this._annotatorPromise;
		await this._pdfjsPromise;
		if (this._uninitialized) {
			return;
		}
		this.annotatorRef.current.navigate(location);
	};

	setEnableAddToNote = async (enable) => {
		await this._annotatorPromise;
		await this._pdfjsPromise;
		if (this._uninitialized) {
			return;
		}
		this.annotatorRef.current.setEnableAddToNote(enable);
	};

	setAnnotations(annotation) {
		this._annotationsStore.setAnnotations(annotation);
	}

	unsetAnnotations(ids) {
		this._annotationsStore.unsetAnnotations(ids);
	}

	setSidebarWidth(width) {
		window.PDFViewerApplication.pdfSidebarResizer._updateWidth(width);
	}

	setSidebarOpen(open) {
		this._enableSidebarOpenEvent = false;
		if (open) {
			window.PDFViewerApplication.pdfSidebar.open();
		}
		else {
			window.PDFViewerApplication.pdfSidebar.close();
		}
		this._enableSidebarOpenEvent = true;
	}

	setBottomPlaceholderHeight(height) {
		let root = document.documentElement;
		root.style.setProperty('--bottomPlaceholderHeight', height + 'px');
	}

	setToolbarPlaceholderWidth(width) {
		let root = document.documentElement;
		root.style.setProperty('--toolbarPlaceholderWidth', width + 'px');
	}

	// TODO: Try to scroll into the required page avoiding first pages rendering to speed up navigation
	_setState(state, skipScroll) {
		// window.PDFViewerApplication.pdfSidebar.switchView(state.sidebarView, true);
		// window.PDFViewerApplication.pdfSidebarResizer._updateWidth(state.sidebarWidth);

		if (Number.isInteger(state.scrollMode)) {
			window.PDFViewerApplication.pdfViewer.scrollMode = state.scrollMode;
		}

		if (Number.isInteger(state.spreadMode)) {
			window.PDFViewerApplication.pdfViewer.spreadMode = state.spreadMode;
		}

		if (Number.isInteger(state.rotation)) {
			window.PDFViewerApplication.pdfViewer.pagesRotation = state.rotation;
		}

		if (!skipScroll) {
			let dest = [null,
				{ name: 'XYZ' },
				// top/left must be null to be ignored
				state.left || null,
				state.top === undefined ? null : state.top,
				parseInt(state.scale) ? state.scale / 100 : state.scale];

			window.PDFViewerApplication.pdfViewer.scrollPageIntoView({
				pageNumber: (state.pageIndex || 0) + 1,
				destArray: dest,
				allowNegativeOffset: true
			});
		}
	}
}

export default Viewer;
