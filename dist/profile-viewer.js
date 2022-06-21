var ProfileViewer = /** @class */ (function () {
    function ProfileViewer(element, data, selectorLabel) {
        this.selections = [];
        this.offsetX = 0;
        this.offsetY = 0;
        this.isWheeling = false;
        this.canWheelDown = true;
        this.scrollPosition = 0;
        this.isResizing = false;
        this.isDocumentScrolling = false;
        this.isMouseMove = false;
        this.scale = window.devicePixelRatio;
        this.borderWidth = 2;
        this.padding = 2;
        this.fontConfig = '10px sans-serif';
        this.borderColor = '#fff';
        this.selectorLabel = 'Thread';
        this.boxHeight = 24;
        this.destroyed = false;
        if (typeof element === 'string') {
            element = document.querySelector(element);
        }
        if (!element) {
            throw new Error('Invalid parent element specified.');
        }
        this.container = element;
        if (selectorLabel) {
            this.selectorLabel = selectorLabel;
        }
        this.insertDOM();
        this.getStyles();
        this.registerResizeObserver();
        this.registerScrollListener();
        if (data) {
            this.setData(data);
        }
        this.getOffset();
    }
    /**
     * Remove event listeners and added child elements. The global stylesheet
     * is only removed if this is the last reference to it (i.e. there are no
     * other not-destroyed ProfileViewer instances in the DOM).
     */
    ProfileViewer.prototype.destroy = function () {
        this.destroyed = true;
        this.resizeObserver.disconnect();
        if (this.scrollHandler) {
            document.removeEventListener('scroll', this.scrollHandler);
        }
        if (this.stylesheet && parseInt(this.stylesheet.dataset.references) === 0) {
            document.head.removeChild(this.stylesheet);
        }
        while (this.container.firstChild) {
            this.container.removeChild(this.container.lastChild);
        }
    };
    ProfileViewer.prototype.setData = function (data) {
        if (this.destroyed) {
            console.error('This profile viewer is destroyed.');
            return;
        }
        if (!data) {
            this.data = data;
            this.clear();
            return;
        }
        var selections = Object.keys(data);
        selections.sort(function (a, b) {
            if (a === 'all') {
                return -1;
            }
            if (b === 'all') {
                return 1;
            }
            if (a < b) {
                return -1;
            }
            if (a > b) {
                return 1;
            }
            return 0;
        });
        this.data = data;
        this.selections = selections;
        this.currentSelection = this.selections[0];
        this.activeNode = this.data[this.currentSelection];
        this.updateFilter();
        this.redraw();
    };
    ProfileViewer.prototype.setSelectorLabel = function (label) {
        this.selectorLabel = label;
        this.selectorLabelElement.innerText = "".concat(label, ": ");
    };
    ProfileViewer.prototype.registerCtrlClickHandler = function (f) {
        this.ctrlClickHandler = f;
    };
    /**
     * @deprecated Use `registerSelectionHandler` instead.
     */
    ProfileViewer.prototype.registerThreadSelectorHandler = function (f) {
        this.selectionHandler = f;
    };
    ProfileViewer.prototype.registerSelectionHandler = function (f) {
        this.selectionHandler = f;
    };
    ProfileViewer.prototype.registerScrollListener = function () {
        document.addEventListener('scroll', this.scrollHandler);
    };
    ProfileViewer.prototype.clear = function () {
        this.selections = [];
        this.currentSelection = '';
        this.activeNode = undefined;
        this.canvasCtx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
        this.hoverCanvasCtx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
    };
    ProfileViewer.prototype.isDestroyed = function () {
        return this.destroyed;
    };
    ProfileViewer.prototype.getStyles = function () {
        var _a, _b, _c;
        var style = window.getComputedStyle(this.container, null);
        var fontFamily = style.fontFamily;
        var fontSize = style.fontSize;
        this.fontConfig =
            parseInt(fontSize !== null && fontSize !== void 0 ? fontSize : '12px', 10) * this.scale +
                'px ' +
                (fontFamily !== null && fontFamily !== void 0 ? fontFamily : 'sans-serif');
        this.borderColor = (_a = style.color) !== null && _a !== void 0 ? _a : '#000';
        this.canvasCtx.font = this.fontConfig;
        this.canvasCtx.textBaseline = 'middle';
        var textMetrics = this.canvasCtx.measureText('ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]*\'"^_`abcdefghijklmnopqrstuvwxyz');
        this.boxHeight = Math.ceil((((_b = textMetrics.fontBoundingBoxDescent) !== null && _b !== void 0 ? _b : textMetrics.actualBoundingBoxDescent) +
            ((_c = textMetrics.fontBoundingBoxAscent) !== null && _c !== void 0 ? _c : textMetrics.actualBoundingBoxAscent) +
            2 * this.borderWidth +
            2 * this.padding) *
            this.scale);
        if (this.activeNode) {
            this.redraw();
        }
    };
    ProfileViewer.prototype.redraw = function () {
        this.canWheelDown = false;
        this.canvasCtx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
        this.clearHover();
        this.drawGraph(this.activeNode, this.canvasWidth, this.canvasHeight, 0, this.scrollPosition);
    };
    ProfileViewer.prototype.insertDOM = function () {
        var _this = this;
        this.insertStylesheet();
        this.canvas = document.createElement('canvas');
        this.canvas.classList.add('__profiler-canvas');
        this.canvasCtx = this.canvas.getContext('2d');
        this.hoverCanvas = document.createElement('canvas');
        this.hoverCanvas.classList.add('__profiler-hover-canvas');
        this.hoverCanvasCtx = this.hoverCanvas.getContext('2d');
        var canvasContainer = document.createElement('div');
        canvasContainer.classList.add('__profiler-canvas-container');
        canvasContainer.appendChild(this.canvas);
        canvasContainer.appendChild(this.hoverCanvas);
        canvasContainer.appendChild(this.createTooltip());
        this.container.appendChild(this.createFilterContainer());
        this.container.appendChild(canvasContainer);
        this.canvas.addEventListener('wheel', function (ev) {
            if (!_this.activeNode) {
                return;
            }
            if (ev.deltaY > 0 && !_this.canWheelDown) {
                return;
            }
            if (ev.deltaY < 0 && _this.scrollPosition === 0) {
                if (-ev.deltaY > _this.boxHeight) {
                    var parent_1 = _this.findParentNode(_this.activeNode);
                    if (parent_1) {
                        ev.preventDefault();
                        ev.stopPropagation();
                        _this.clearHover();
                        _this.activeNode = parent_1;
                        _this.redraw();
                    }
                    return;
                }
            }
            ev.preventDefault();
            ev.stopPropagation();
            if (!_this.isWheeling) {
                window.requestAnimationFrame(function () {
                    _this.scrollPosition = Math.min(0, _this.scrollPosition - ev.deltaY);
                    _this.redraw();
                    _this.isWheeling = false;
                });
                _this.isWheeling = true;
            }
        });
        this.canvas.addEventListener('mousemove', function (ev) {
            if (!_this.isMouseMove && _this.activeNode) {
                window.requestAnimationFrame(function () {
                    // XXX: this is bad
                    _this.getOffset();
                    var mouseX = ev.clientX - _this.offsetX;
                    var mouseY = ev.clientY - _this.offsetY;
                    _this.hoverCanvasCtx.clearRect(0, 0, _this.canvasWidth, _this.canvasHeight);
                    var didDraw = _this.drawHover(_this.activeNode, _this.scale * mouseX, _this.scale * mouseY);
                    if (didDraw) {
                        if (mouseX > _this.canvasWidthCSS / 2) {
                            _this.tooltipElement.style.right =
                                _this.canvasWidthCSS - mouseX + 10 + 'px';
                            _this.tooltipElement.style.left = 'unset';
                        }
                        else {
                            _this.tooltipElement.style.right = 'unset';
                            _this.tooltipElement.style.left = mouseX + 10 + 'px';
                        }
                        if (mouseY > _this.canvasHeightCSS / 2) {
                            _this.tooltipElement.style.bottom =
                                _this.canvasHeightCSS - mouseY + 10 + 'px';
                            _this.tooltipElement.style.top = 'unset';
                        }
                        else {
                            _this.tooltipElement.style.bottom = 'unset';
                            _this.tooltipElement.style.top = mouseY + 10 + 'px';
                        }
                        _this.tooltipElement.style.display = 'block';
                    }
                    else {
                        _this.tooltipElement.style.display = 'none';
                    }
                    _this.isMouseMove = false;
                });
                _this.isMouseMove = true;
            }
        });
        this.canvas.addEventListener('click', function (ev) {
            if (!_this.activeNode) {
                return;
            }
            ev.preventDefault();
            ev.stopPropagation();
            _this.getOffset();
            var mouseX = _this.scale * (ev.clientX - _this.offsetX);
            var mouseY = _this.scale * (ev.clientY - _this.offsetY);
            if (ev.ctrlKey || ev.metaKey) {
                _this.runOnNodeAtMousePosition(_this.activeNode, mouseX, mouseY, function (node) {
                    if (_this.ctrlClickHandler) {
                        _this.ctrlClickHandler(node);
                    }
                });
            }
            else {
                if (_this.zoomInOnNode(_this.activeNode, mouseX, mouseY)) {
                    _this.scrollPosition = 0;
                    _this.redraw();
                }
                else if (ev.detail === 2) {
                    // reset on double-click
                    _this.resetView();
                }
            }
        });
    };
    ProfileViewer.prototype.resetView = function () {
        this.activeNode = this.data[this.currentSelection];
        this.scrollPosition = 0;
        this.redraw();
    };
    ProfileViewer.prototype.insertStylesheet = function () {
        var stylesheet = document.querySelector('#__profiler_stylesheet');
        if (stylesheet) {
            stylesheet.dataset.references = (parseInt(stylesheet.dataset.references) + 1).toString();
            this.stylesheet = stylesheet;
        }
        else {
            this.stylesheet = document.createElement('style');
            this.stylesheet.setAttribute('id', '__profiler-stylesheet');
            this.stylesheet.dataset.references = '0';
            this.stylesheet.innerText = "\n                .__profiler-canvas {\n                    z-index: 0;\n                    position: absolute;\n                    width: 100%;\n                }\n                .__profiler-canvas-container {\n                  width: 100%;\n                  height: 100%;\n                  position: relative;\n                }\n                .__profiler-hover-canvas {\n                    z-index: 1;\n                    position: absolute;\n                    pointer-events: none;\n                    width: 100%;\n                }\n                .__profiler-tooltip {\n                    z-index: 2;\n                    display: none;\n                    position: absolute;\n                    background-color: #ddd;\n                    border: 1px solid black;\n                    padding: 5px 10px;\n                    pointer-events: none;\n                    max-width: 45%;\n                    overflow: hidden;\n                }\n                .__profiler-tooltip > div {\n                    line-break: anywhere;\n                }\n                .__profiler-filter {\n                    height: 30px;\n                    padding: 2px 16px;\n                    margin: 0;\n                    box-sizing: border-box;\n                    border-bottom: 1px solid #444;\n                    user-select: none;\n                }\n                .__profiler-reset {\n                    float: right;\n                }\n            ";
            document.head.appendChild(this.stylesheet);
        }
    };
    ProfileViewer.prototype.createTooltip = function () {
        this.tooltipElement = document.createElement('div');
        this.tooltipElement.classList.add('__profiler-tooltip');
        this.tooltip = {
            count: document.createElement('span'),
            percentage: document.createElement('span'),
            function: document.createElement('code'),
            file: document.createElement('a'),
            flags: document.createElement('span'),
        };
        this.tooltip.function.classList.add('fname');
        var rows = [
            [this.tooltip.function],
            [
                this.tooltip.count,
                document.createTextNode(' ('),
                this.tooltip.percentage,
                document.createTextNode(') '),
            ],
            [this.tooltip.file],
            [this.tooltip.flags],
        ];
        for (var _i = 0, rows_1 = rows; _i < rows_1.length; _i++) {
            var row = rows_1[_i];
            var rowContainer = document.createElement('div');
            for (var _a = 0, row_1 = row; _a < row_1.length; _a++) {
                var col = row_1[_a];
                rowContainer.appendChild(col);
            }
            this.tooltipElement.appendChild(rowContainer);
        }
        this.tooltip['ctrlClickHint'] = document.createElement('small');
        this.tooltipElement.appendChild(this.tooltip['ctrlClickHint']);
        this.container.appendChild(this.tooltipElement);
        return this.tooltipElement;
    };
    ProfileViewer.prototype.createFilterContainer = function () {
        var _this = this;
        this.filterContainer = document.createElement('div');
        this.filterContainer.classList.add('__profiler-filter');
        this.selectorLabelElement = document.createElement('label');
        this.selectorLabelElement.innerText = "".concat(this.selectorLabel, ": ");
        this.filterContainer.appendChild(this.selectorLabelElement);
        this.filterInput = document.createElement('select');
        this.filterInput.addEventListener('change', function () {
            _this.currentSelection = _this.filterInput.value;
            if (_this.selectionHandler) {
                _this.selectionHandler(_this.currentSelection);
            }
            _this.resetView();
        });
        this.filterContainer.appendChild(this.filterInput);
        var resetter = document.createElement('button');
        resetter.classList.add('__profiler-reset');
        resetter.innerText = 'reset view';
        resetter.addEventListener('click', function () {
            _this.resetView();
        });
        this.filterContainer.appendChild(resetter);
        return this.filterContainer;
    };
    ProfileViewer.prototype.updateFilter = function () {
        while (this.filterInput.firstChild) {
            this.filterInput.removeChild(this.filterInput.lastChild);
        }
        for (var _i = 0, _a = this.selections; _i < _a.length; _i++) {
            var selection = _a[_i];
            var entry = document.createElement('option');
            entry.innerText = selection;
            entry.setAttribute('value', selection);
            this.filterInput.appendChild(entry);
        }
    };
    ProfileViewer.prototype.registerResizeObserver = function () {
        var _this = this;
        this.resizeObserver = new ResizeObserver(function (entries) {
            if (!_this.isResizing) {
                var _loop_1 = function (entry) {
                    if (entry.target === _this.container) {
                        window.requestAnimationFrame(function () {
                            if (window.devicePixelRatio !== _this.scale) {
                                _this.scale = window.devicePixelRatio;
                                _this.getStyles();
                            }
                            _this.canvasWidth = Math.round(entry.contentRect.width * _this.scale);
                            _this.canvasHeight = Math.round((entry.contentRect.height - 30) * _this.scale);
                            _this.canvasWidthCSS = entry.contentRect.width;
                            _this.canvasHeightCSS = entry.contentRect.height;
                            _this.canvas.width = _this.canvasWidth;
                            _this.canvas.height = _this.canvasHeight;
                            _this.hoverCanvas.width = _this.canvasWidth;
                            _this.hoverCanvas.height = _this.canvasHeight;
                            _this.redraw();
                            _this.isResizing = false;
                        });
                    }
                };
                for (var _i = 0, entries_1 = entries; _i < entries_1.length; _i++) {
                    var entry = entries_1[_i];
                    _loop_1(entry);
                }
                _this.isResizing = true;
            }
        });
        this.resizeObserver.observe(this.container);
    };
    ProfileViewer.prototype.scrollHandler = function (e) {
        var _this = this;
        if (!this.isDocumentScrolling) {
            window.requestAnimationFrame(function () {
                _this.getOffset();
                _this.isDocumentScrolling = false;
            });
            this.isDocumentScrolling = true;
        }
    };
    ProfileViewer.prototype.getOffset = function () {
        var box = this.canvas.getBoundingClientRect();
        this.offsetX = box.left;
        this.offsetY = box.top;
    };
    // hash of function named, used to seed PRNG
    ProfileViewer.prototype.nodeHash = function (node) {
        var hashString = node.file + node.line;
        var hash = 0;
        for (var i = 0; i < hashString.length; i++) {
            var char = hashString.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash;
        }
        return hash;
    };
    // Simple PRNG from https://stackoverflow.com/a/47593316/12113178
    ProfileViewer.prototype.mulberry32 = function (a) {
        return function () {
            var t = (a += 0x6d2b79f5);
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    };
    // modifies the normal color by three stable random values drawn from a
    // PRNG seeded by the node hash
    ProfileViewer.prototype.modifyNodeColorByHash = function (r, g, b, hash, range) {
        if (range === void 0) { range = 70; }
        var rng = this.mulberry32(hash);
        if (r === g && g === b) {
            r = g = b = Math.min(255, Math.max(0, r + (rng() - 0.5) * range));
        }
        else {
            r = Math.min(255, Math.max(0, r + (rng() - 0.5) * range));
            g = Math.min(255, Math.max(0, g + (rng() - 0.5) * range));
            b = Math.min(255, Math.max(0, b + (rng() - 0.5) * range));
        }
        return {
            r: r,
            g: g,
            b: b,
        };
    };
    ProfileViewer.prototype.nodeColors = function (node, hash) {
        var _a, _b, _c, _d;
        var r, g, b;
        var a = 1;
        if (node.flags & 0x01) {
            // runtime-dispatch
            ;
            (_a = this.modifyNodeColorByHash(204, 103, 103, hash, 20), r = _a.r, g = _a.g, b = _a.b);
        }
        else if (node.flags & 0x02) {
            // gc
            ;
            (_b = this.modifyNodeColorByHash(204, 153, 68, hash, 20), r = _b.r, g = _b.g, b = _b.b);
        }
        else if (node.flags & 0x08) {
            // compilation?
            ;
            (_c = this.modifyNodeColorByHash(100, 100, 100, hash, 60), r = _c.r, g = _c.g, b = _c.b);
        }
        else {
            // default
            ;
            (_d = this.modifyNodeColorByHash(64, 99, 221, hash), r = _d.r, g = _d.g, b = _d.b);
        }
        if (node.flags & 0x10) {
            // C frame
            a = 0.5;
        }
        return {
            fill: 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')',
            stroke: 'rgba(' + 0.8 * r + ',' + 0.8 * g + ',' + 0.8 * b + ',' + a + ')',
            text: 'rgba(255, 255, 255, ' + Math.max(0.6, a) + ')',
        };
    };
    ProfileViewer.prototype.drawGraph = function (node, width, height, x, y) {
        if (!node) {
            return;
        }
        this.canvasCtx.font = this.fontConfig;
        this.canvasCtx.textBaseline = 'middle';
        if (y + this.boxHeight >= 0) {
            var hash = this.nodeHash(node);
            var _a = this.nodeColors(node, hash), fill = _a.fill, stroke = _a.stroke, text = _a.text;
            this.drawNode(node.func, fill, stroke, text, width, x, y);
        }
        node.pos = {
            x: x,
            y: y,
            width: width,
            height: this.boxHeight,
        };
        if (y + this.boxHeight <= this.canvasHeight) {
            for (var _i = 0, _b = node.children; _i < _b.length; _i++) {
                var child = _b[_i];
                var w = width * (child.fraction || child.count / node.count);
                this.drawGraph(child, w, height, x, y + this.boxHeight);
                x += w;
            }
        }
        else {
            this.canWheelDown = true;
        }
    };
    ProfileViewer.prototype.drawNode = function (text, color, bColor, textColor, width, x, y) {
        if (width < 1) {
            width = 1;
        }
        var drawBorder = false; //width > 20*this.borderWidth;
        this.canvasCtx.fillStyle = color;
        this.canvasCtx.beginPath();
        this.canvasCtx.rect(x, y + this.borderWidth, width, this.boxHeight - this.borderWidth);
        this.canvasCtx.closePath();
        this.canvasCtx.fill();
        if (drawBorder) {
            this.canvasCtx.fillStyle = bColor;
            this.canvasCtx.beginPath();
            this.canvasCtx.rect(x, y + this.borderWidth, this.borderWidth, this.boxHeight - this.borderWidth);
            this.canvasCtx.closePath();
            this.canvasCtx.fill();
        }
        var textWidth = width - 2 * this.padding - 2 * this.borderWidth;
        if (textWidth > 10) {
            this.canvasCtx.save();
            this.canvasCtx.beginPath();
            this.canvasCtx.rect(x + this.borderWidth + this.padding, y + this.borderWidth + this.padding, textWidth, this.boxHeight - this.borderWidth - 2 * this.padding);
            this.canvasCtx.closePath();
            this.canvasCtx.clip();
            this.canvasCtx.fillStyle = textColor;
            this.canvasCtx.fillText(text, x + this.borderWidth + this.padding, y + this.boxHeight / 2 + this.borderWidth);
            this.canvasCtx.restore();
        }
    };
    ProfileViewer.prototype.updateTooltip = function (node) {
        this.tooltip.function.innerText = node.func;
        if (node.file || node.line > 0) {
            this.tooltip.file.innerText = node.file + ':' + node.line;
        }
        else {
            this.tooltip.file.innerText = '';
        }
        this.tooltip.count.innerText = (node.countLabel || (node.count + ' samples')).toString();
        var percentageText = ((100 * node.count) /
            this.data[this.currentSelection].count).toFixed() + '% of root';
        if (this.activeNode.count != this.data[this.currentSelection].count) {
            percentageText = percentageText + ', ' + ((100 * node.count) /
                this.activeNode.count).toFixed() + '% of top';
        }
        this.tooltip.percentage.innerText = percentageText;
        var flags = [];
        if (node.flags & 0x01) {
            flags.push('runtime-dispatch');
        }
        if (node.flags & 0x02) {
            flags.push('GC');
        }
        if (node.flags & 0x08) {
            flags.push('compilation');
        }
        if (node.flags & 0x10) {
            flags.push('task');
        }
        var flagString = '';
        if (flags.length > 0) {
            flagString = 'Flags: ' + flags.join(', ');
        }
        this.tooltip.flags.innerText = flagString;
        if (this.ctrlClickHandler) {
            this.tooltip['ctrlClickHint'].innerText =
                'Ctrl/Cmd+Click to open this file';
        }
    };
    ProfileViewer.prototype.drawHoverNode = function (node) {
        this.hoverCanvasCtx.fillStyle = this.borderColor;
        this.hoverCanvasCtx.fillRect(node.pos.x, node.pos.y + this.borderWidth, Math.max(1, node.pos.width), node.pos.height - this.borderWidth);
        var innerWidth = node.pos.width - this.borderWidth * 2 * this.scale;
        if (innerWidth > 1) {
            this.hoverCanvasCtx.clearRect(node.pos.x + this.borderWidth * this.scale, node.pos.y + 2 * this.borderWidth * this.scale, innerWidth, node.pos.height - this.borderWidth * 3 * this.scale);
        }
        this.updateTooltip(node);
    };
    ProfileViewer.prototype.clearHover = function () {
        this.hoverCanvasCtx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
        this.tooltipElement.style.display = 'none';
    };
    ProfileViewer.prototype.drawHover = function (node, mouseX, mouseY) {
        var _this = this;
        var found = false;
        this.runOnNodeAtMousePosition(node, mouseX, mouseY, function (node) {
            _this.drawHoverNode(node);
            found = true;
        });
        return found;
    };
    ProfileViewer.prototype.runOnNodeAtMousePosition = function (root, x, y, f) {
        if (x >= Math.floor(root.pos.x) &&
            x <= Math.ceil(root.pos.x + root.pos.width) &&
            y >= root.pos.y) {
            if (y <= root.pos.y + root.pos.height) {
                f(root);
                return true;
            }
            else {
                for (var _i = 0, _a = root.children; _i < _a.length; _i++) {
                    var child = _a[_i];
                    if (this.runOnNodeAtMousePosition(child, x, y, f)) {
                        return true;
                    }
                }
            }
        }
        return false;
    };
    ProfileViewer.prototype.zoomInOnNode = function (node, mouseX, mouseY) {
        var _this = this;
        var found = false;
        this.runOnNodeAtMousePosition(node, mouseX, mouseY, function (node) {
            _this.clearHover();
            _this.activeNode = node;
            found = true;
        });
        return found;
    };
    // ideally this wouldn't require tree traversal at all
    ProfileViewer.prototype.findParentNode = function (target, current) {
        if (current === void 0) { current = null; }
        if (current === null) {
            current = this.data[this.currentSelection];
        }
        for (var _i = 0, _a = current.children; _i < _a.length; _i++) {
            var child = _a[_i];
            if (child === target) {
                return current;
            }
            else {
                var found = this.findParentNode(target, child);
                if (found) {
                    return found;
                }
            }
        }
        return null;
    };
    return ProfileViewer;
}());
export { ProfileViewer };
//# sourceMappingURL=profile-viewer.js.map