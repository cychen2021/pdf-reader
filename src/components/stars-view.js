import React, { forwardRef, memo } from 'react';
import ReactDOM from 'react-dom';
import { FormattedMessage } from 'react-intl';

const StarsView = memo(forwardRef(function (props, _ref) {
	function getContainerNode() {
		return document.getElementById("starsView");
	}

	function getStarredPages() {
		let { _starredPages } = props;
		return [];
	}

	let starredPages = getStarredPages();

	return ReactDOM.createPortal(
		<>
			<div id="starredPages">
				{starredPages.length
					? <p><b>TODO</b></p>
					: <div><FormattedMessage id="pdfReader.noStarredPages"/></div>
				}
			</div>
		</>,
		getContainerNode()
	);
}));

export default StarsView;
