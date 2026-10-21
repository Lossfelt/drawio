const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {test} = require('node:test');

const webapp = path.join(__dirname, '../main/webapp');
const files = [
	'mxgraph/src/handler/mxGraphHandler.js',
	'mxgraph/mxClient.js',
	'js/app.min.js',
	'js/integrate.min.js',
	'js/viewer.min.js',
	'js/viewer-static.min.js'
];

function loadPreview(file)
{
	const source = fs.readFileSync(path.join(webapp, file), 'utf8');
	const start = source.indexOf('mxGraphHandler.prototype.updateLivePreview');
	const end = source.indexOf('mxGraphHandler.prototype.redrawHandles', start);
	const context = {
		mxGraphHandler: function() {},
		mxUtils: {bind: (owner, fn) => fn.bind(owner)},
		mxPoint: function(x, y) { this.x = x; this.y = y; }
	};

	vm.runInNewContext(source.slice(start, end), context);
	return context.mxGraphHandler.prototype.updateLivePreview;
}

function preview(update, {moving = [], disconnect = false, cloning = false, dangling = false})
{
	const edge = {};
	const source = {cell: {}, x: 0, y: 0};
	const target = {cell: {}, x: 100, y: 100};
	let terminals;
	let routePoints;
	let restored = false;
	const fixed = [];
	const loose = [];
	const state = {
		cell: edge,
		visibleSourceState: dangling ? null : source,
		visibleTargetState: target,
		clone: () => ({absolutePoints: [{x: 0, y: 0}, {x: 100, y: 100}]}),
		setAbsoluteTerminalPoint: (point, isSource) => loose.push({point, isSource})
	};
	const view = {
		scale: 2,
		getState: () => state,
		getFixedTerminalPoint: () => ({x: 0, y: 0}),
		updateFixedTerminalPoint: (state, terminal) => fixed.push(terminal),
		updatePoints: (state, points, from, to) => { routePoints = points; terminals = [from, to]; },
		updateFloatingTerminalPoints: () => {},
		updateEdgeLabelOffset: () => {},
		validate: () => {}
	};
	const graph = {
		view,
		model: {isVertex: () => false, isEdge: () => true},
		getCellGeometry: () => ({points: [{x: 20, y: 30}]}),
		isDisconnectOnMove: () => disconnect,
		isCellCloneable: () => true,
		getConnectionConstraint: () => ({}),
		cellRenderer: {redraw: () => {}}
	};
	state.view = view;
	view.graph = graph;
	const handler = {
		graph,
		cloning,
		allCells: {visit: fn => fn('edge', state)},
		isCellMoving: cell => moving.includes(cell === source.cell ? 'source' : 'target'),
		redrawHandles: () => {},
		resetPreviewStates: () => { restored = true; }
	};

	update.call(handler, 40, 60);
	assert.equal(restored, true, 'preview states must be restored');
	assert.equal(routePoints[0].x, 40, 'waypoints retain the scaled movement');
	assert.equal(routePoints[0].y, 60);
	return {terminals, source, target, fixed, loose};
}

for (const file of files)
{
	const update = loadPreview(file);

	for (const moving of [[], ['source'], ['target'], ['source', 'target']])
	{
		test(file + ': attached preview with moving terminals ' + moving.join(','), () =>
		{
			const result = preview(update, {moving});
			assert.deepEqual(result.terminals, [result.source, result.target]);
			assert.equal(result.fixed.length, 2);
			assert.equal(result.loose.length, 0);
		});
	}

	for (const options of [{disconnect: true}, {cloning: true}])
	{
		test(file + ': original detached preview for ' + JSON.stringify(options), () =>
		{
			const result = preview(update, {...options, moving: ['target']});
			assert.deepEqual(result.terminals, [null, result.target]);
			assert.equal(result.loose[0].point.x, 40);
			assert.equal(result.loose[0].point.y, 60);
		});
	}

	test(file + ': dangling endpoint still follows the selection', () =>
	{
		const result = preview(update, {dangling: true});
		assert.deepEqual(result.terminals, [null, result.target]);
		assert.equal(result.loose[0].point.x, 40);
		assert.equal(result.loose[0].point.y, 60);
	});
}
