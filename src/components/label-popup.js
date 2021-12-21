'use strict';

import React, { useState, useEffect, useRef } from 'react';
import { FormattedMessage } from 'react-intl';
import Popup from './popup';

function LabelPopup({ data, onUpdate, onClose }) {
	let [label, setLabel] = useState(data.pageLabel);
	let [checked, setChecked] = useState(data.checked);
	let [auto, setAuto] = useState(false);
	let inputRef = useRef();

	useEffect(() => {
		inputRef.current.focus();
		inputRef.current.select();
	}, []);

	function handleUpdateClick() {
		if (auto) {
			onUpdate('auto');
		}
		else {
			onUpdate(checked, label.trim());
		}
	}

	function handleInputKeydown(event) {
		if (event.key === 'Enter') {
			handleUpdateClick();
		}
	}

	function handleChange(event) {
		setLabel(event.target.value);
	}

	function handleCheckboxChange(event) {
		setAuto(event.target.checked);
	}

	function handleRadioChange(event) {
		setChecked(event.target.value);
	}

	let forceSingle = false;
	if (parseInt(label) != label || parseInt(label) < 1) {
		forceSingle = true;
		if (data.single) {
			checked = 'single';
		}
		else {
			checked = 'selected';
		}
	}

	let disabled = !label.trim().length;

	if (auto) {
		checked = 'all';
		disabled = false;
	}

	return (
		<Popup id="labelPopup" data={data} onClose={onClose}>
			<div className="row label">
				<div className="column first">
					<input
						ref={inputRef}
						type="text"
						className="toolbarField"
						value={auto ? data.autoPageLabel : label}
						disabled={auto}
						maxLength={16}
						onChange={handleChange}
						onKeyDown={handleInputKeydown}
					/>
				</div>
				<div className="column second">
					<input
						id="renumber-auto-detect"
						type="checkbox"
						checked={auto}
						onChange={handleCheckboxChange}
					/>
					<label htmlFor="renumber-auto-detect"><FormattedMessage id="pdfReader.autoDetect"/></label>
				</div>
			</div>
			<div className="row radio">
				{data.single && !auto && <div className="choice">
					<input
						type="radio"
						id="renumber-selected"
						name="renumber"
						value="single"
						checked={checked === 'single' && !disabled}
						onChange={handleRadioChange} disabled={disabled}
					/>
					<label htmlFor="renumber-selected"><FormattedMessage id="pdfReader.thisAnnotation"/></label>
				</div>}
				{data.selected && !auto && <div className="choice">
					<input
						type="radio"
						id="renumber-selected"
						name="renumber"
						value="selected"
						checked={checked === 'selected' && !disabled}
						disabled={disabled} onChange={handleRadioChange}
					/>
					<label htmlFor="renumber-selected"><FormattedMessage id="pdfReader.selectedAnnotations"/></label>
				</div>}
				{data.page && !auto && <div className="choice">
					<input
						type="radio"
						id="renumber-page"
						name="renumber"
						value="page"
						checked={checked === 'page'}
						disabled={forceSingle || disabled}
						onChange={handleRadioChange}
					/>
					<label htmlFor="renumber-page"><FormattedMessage id="pdfReader.thisPage"/></label>
				</div>}
				{data.from && !auto && <div className="choice">
					<input
						type="radio"
						id="renumber-from-page"
						name="renumber"
						value="from"
						checked={checked === 'from'}
						disabled={forceSingle || disabled}
						onChange={handleRadioChange}
					/>
					<label htmlFor="renumber-from-page"><FormattedMessage id="pdfReader.thisPageAndLaterPages"/></label>
				</div>}
				{(data.all || auto) && <div className="choice">
					<input
						type="radio"
						id="renumber-all"
						name="renumber"
						value="all"
						checked={checked === 'all'}
						disabled={forceSingle || disabled}
						onChange={handleRadioChange}
					/>
					<label htmlFor="renumber-all"><FormattedMessage id="pdfReader.allPages"/></label>
				</div>}
			</div>
			<div className="row buttons">
				<button
					className="overlayButton submit"
					onClick={handleUpdateClick}
					disabled={disabled}
				><FormattedMessage id="general.update"/></button>
			</div>
		</Popup>
	);
}

export default LabelPopup;
