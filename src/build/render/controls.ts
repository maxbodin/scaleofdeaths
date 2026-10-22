import type { SiteModel } from '../model.ts';
import { catVar, pick, pickHtml, type RenderContext } from './context.ts';
import { attrs, esc, join } from './html.ts';

/**
 * Renders the sort select: deaths or date, ascending or descending. It has no visible label, so its accessible name comes from `aria-label`.
 *
 * @param ctx Render context.
 * @returns HTML.
 */
function sortSelect(ctx: RenderContext): string {
	const { t } = ctx;
	const options: Array<[string, string]> = [
		['deaths-asc', t.sortDeathsAsc],
		['deaths-desc', t.sortDeathsDesc],
		['date-asc', t.sortDateAsc],
		['date-desc', t.sortDateDesc],
	];

	return join([
		`<select id="sort" class="sort" aria-label="${esc(t.sort)}">`,
		...options.map(([value, label]) => `<option value="${value}">${esc(label)}</option>`),
		'</select>',
	]);
}

/**
 * Renders one checkbox chip per category, all checked by default.
 *
 * @param model Site model.
 * @param ctx Render context.
 * @returns HTML.
 */
function categoryFieldset(model: SiteModel, ctx: RenderContext): string {
	const chips = model.categories.map((c) =>
		join([
			`<label class="chip" style="--c:${catVar(c.id)}">`,
			`<input type="checkbox" name="cat" value="${esc(c.id)}" checked>`,
			`<span>${pickHtml(ctx, c.label)}</span>`,
			'</label>',
		]),
	);

	return join([
		'<fieldset class="fs">',
		`<legend>${esc(ctx.t.categories)}</legend>`,
		'<div class="chips">',
		...chips,
		'</div>',
		'</fieldset>',
	]);
}

/**
 * Renders the country type-ahead input, its datalist (sorted for the page language) and the
 * list of picked countries.
 *
 * @param model Site model.
 * @param ctx Render context.
 * @returns HTML.
 */
function countryFieldset(model: SiteModel, ctx: RenderContext): string {
	const options = model.countries
		.map((c) => ({ key: c.key, label: pick(ctx, c.label) }))
		.sort((a, b) => a.label.localeCompare(b.label, ctx.locale));

	const input = attrs({
		id: 'country-input',
		list: 'country-list',
		placeholder: ctx.t.countryPlaceholder,
		'aria-label': ctx.t.countries,
		autocomplete: 'off',
	});

	return join([
		'<fieldset class="fs">',
		`<legend>${esc(ctx.t.countries)}</legend>`,
		'<div class="row">',
		`<input${input}>`,
		`<button type="button" id="country-add">${esc(ctx.t.addCountry)}</button>`,
		'</div>',
		'<datalist id="country-list">',
		...options.map((o) => `<option value="${esc(o.label)}" data-key="${esc(o.key)}"></option>`),
		'</datalist>',
		'<ul class="picked" id="country-chips"></ul>',
		'</fieldset>',
	]);
}

/**
 * Renders a year input and its era select (CE or BCE) for one end of the period filter.
 *
 * @param id Which end of the period.
 * @param ctx Render context.
 * @returns HTML.
 */
function yearRow(id: 'from' | 'to', ctx: RenderContext): string {
	const { t } = ctx;
	const label = id === 'from' ? t.from : t.to;

	const input = attrs({
		id: `${id}-year`,
		type: 'number',
		min: 1,
		max: 9999,
		step: 1,
		inputmode: 'numeric',
		'aria-label': `${label} - ${t.year}`,
	});

	return join([
		'<div class="row">',
		`<span class="row-l" aria-hidden="true">${esc(label)}</span>`,
		`<input${input}>`,
		`<select id="${id}-era" aria-label="${esc(`${label} - ${t.era}`)}">`,
		`<option value="ce">${esc(t.ce)}</option>`,
		`<option value="bce">${esc(t.bce)}</option>`,
		'</select>',
		'</div>',
	]);
}

/**
 * Renders the period filter (from and to years).
 *
 * @param ctx Render context.
 * @returns HTML.
 */
function periodFieldset(ctx: RenderContext): string {
	return join([
		'<fieldset class="fs">',
		`<legend>${esc(ctx.t.period)}</legend>`,
		yearRow('from', ctx),
		yearRow('to', ctx),
		'</fieldset>',
	]);
}

/**
 * Renders the search field and its list of suggestions, filled in by the browser script.
 *
 * @param ctx Render context.
 * @returns HTML.
 */
function searchFieldset(ctx: RenderContext): string {
	const { t } = ctx;
	const input = attrs({
		id: 'q',
		type: 'search',
		role: 'combobox',
		placeholder: t.searchPlaceholder,
		autocomplete: 'off',
		spellcheck: 'false',
		'aria-autocomplete': 'list',
		'aria-expanded': 'false',
		'aria-controls': 'q-list',
	});

	return join([
		'<fieldset class="fs fs-search">',
		`<legend><label for="q">${esc(t.search)}</label></legend>`,
		'<div class="combo">',
		`<input${input}>`,
		`<ul class="combo-l" id="q-list" role="listbox" aria-label="${esc(t.search)}" hidden></ul>`,
		'</div>',
		'</fieldset>',
	]);
}

/**
 * Renders the filters panel, hidden until the filters button opens it.
 *
 * @param model Site model.
 * @param ctx Render context.
 * @returns HTML.
 */
function filtersPanel(model: SiteModel, ctx: RenderContext): string {
	return join([
		'<div class="panel" id="panel" hidden>',
		'<div class="panel-in">',
		searchFieldset(ctx),
		categoryFieldset(model, ctx),
		countryFieldset(model, ctx),
		periodFieldset(ctx),
		'<div class="panel-a">',
		`<button type="button" class="btn" data-reset>${esc(ctx.t.reset)}</button>`,
		`<button type="button" class="btn btn-q" id="panel-close">${esc(ctx.t.close)}</button>`,
		'</div>',
		'</div>',
		'</div>',
	]);
}

/**
 * Renders the sticky control bar (sort select, filters button and random event button) and its filters panel.
 *
 * @param model Site model.
 * @param ctx Render context.
 * @returns HTML.
 */
export function renderBar(model: SiteModel, ctx: RenderContext): string {
	return join([
		'<div class="bar" data-js>',
		'<div class="bar-in">',
		sortSelect(ctx),
		'<button type="button" class="btn btn-regular" id="filters-btn" aria-expanded="false" aria-controls="panel">',
		esc(ctx.t.filters),
		'<span class="badge" id="filters-count" hidden></span>',
		'</button>',
		'<button type="button" class="btn btn-regular" id="random-btn">',
		'<i class="dice" aria-hidden="true"></i>',
		`<span class="btn-l">${esc(ctx.t.random)}</span>`,
		'</button>',
		'</div>',
		filtersPanel(model, ctx),
		'</div>',
	]);
}
