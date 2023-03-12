import '../css/easymde.scss';

import CodeMirror from 'codemirror';
import 'codemirror/addon/edit/continuelist.js';
import './codemirror/tablist';
import 'codemirror/addon/display/fullscreen.js';
import 'codemirror/mode/markdown/markdown.js';
import 'codemirror/addon/mode/overlay.js';
import 'codemirror/addon/display/placeholder.js';
import 'codemirror/addon/display/autorefresh.js';
import 'codemirror/addon/selection/mark-selection.js';
import 'codemirror/addon/search/searchcursor.js';
import 'codemirror/mode/gfm/gfm.js';
import 'codemirror/mode/xml/xml.js';
import CodeMirrorSpellChecker from 'codemirror-spell-checker';
import { marked } from 'marked';

import { isMobile, insertTexts, promptTexts, blockStyles, timeFormat, imageTexts, errorMessages } from './constants';
import { addAnchorTargetBlank, removeListStyleWhenCheckbox } from './html-utils';
import { getState } from './cm-utils';
import { toolbarBuiltInButtons, createSep, createToolbarDropdown, createToolbarButton, iconClassMap } from './toolbar-ui';
import { bindings, shortcuts, fixShortcut } from './bindings';
import { toggleBold, toggleItalic, drawLink, toggleHeadingSmaller, toggleHeadingBigger, drawImage, drawUploadedImage, afterImageUploaded, toggleBlockquote, toggleOrderedList, toggleUnorderedList, toggleCodeBlock, togglePreview, toggleStrikethrough, toggleHeading1, toggleHeading2, toggleHeading3, toggleHeading4, toggleHeading5, toggleHeading6, cleanBlock, drawTable, drawHorizontalRule, undo, redo, toggleSideBySide, toggleFullScreen } from './actions';

/**
 * Convert a number of bytes to a human-readable file size. If you desire
 * to add a space between the value and the unit, you need to add this space
 * to the given units.
 * @param bytes {number} A number of bytes, as integer. Ex: 421137
 * @param units {number[]} An array of human-readable units, ie. [' B', ' K', ' MB']
 * @returns string A human-readable file size. Ex: '412 KB'
 */
function humanFileSize(bytes, units) {
    if (Math.abs(bytes) < 1024) {
        return '' + bytes + units[0];
    }
    var u = 0;
    do {
        bytes /= 1024;
        ++u;
    } while (Math.abs(bytes) >= 1024 && u < units.length);
    return '' + bytes.toFixed(1) + units[u];
}

// Merge the properties of one object into another.
function _mergeProperties(target, source) {
    for (var property in source) {
        if (Object.prototype.hasOwnProperty.call(source, property)) {
            if (source[property] instanceof Array) {
                target[property] = source[property].concat(target[property] instanceof Array ? target[property] : []);
            } else if (
                source[property] !== null &&
                typeof source[property] === 'object' &&
                source[property].constructor === Object
            ) {
                target[property] = _mergeProperties(target[property] || {}, source[property]);
            } else {
                target[property] = source[property];
            }
        }
    }

    return target;
}

// Merge an arbitrary number of objects into one.
function extend(target) {
    for (var i = 1; i < arguments.length; i++) {
        target = _mergeProperties(target, arguments[i]);
    }

    return target;
}

/* The right word count in respect for CJK. */
function wordCount(data) {
    var pattern = /[a-zA-Z0-9_\u00A0-\u02AF\u0392-\u03c9\u0410-\u04F9]+|[\u4E00-\u9FFF\u3400-\u4dbf\uf900-\ufaff\u3040-\u309f\uac00-\ud7af]+/g;
    var m = data.match(pattern);
    var count = 0;
    if (m === null) return count;
    for (var i = 0; i < m.length; i++) {
        if (m[i].charCodeAt(0) >= 0x4E00) {
            count += m[i].length;
        } else {
            count += 1;
        }
    }
    return count;
}

/**
 * Interface of EasyMDE.
 */
export default function EasyMDE(options) {
    // Handle options parameter
    options = options || {};

    // Used later to refer to it"s parent
    options.parent = this;

    // Check if Font Awesome needs to be auto downloaded
    var autoDownloadFA = true;

    if (options.autoDownloadFontAwesome === false) {
        autoDownloadFA = false;
    }

    if (options.autoDownloadFontAwesome !== true) {
        var styleSheets = document.styleSheets;
        for (var i = 0; i < styleSheets.length; i++) {
            if (!styleSheets[i].href)
                continue;

            if (styleSheets[i].href.indexOf('//maxcdn.bootstrapcdn.com/font-awesome/') > -1) {
                autoDownloadFA = false;
            }
        }
    }

    if (autoDownloadFA) {
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://maxcdn.bootstrapcdn.com/font-awesome/latest/css/font-awesome.min.css';
        document.getElementsByTagName('head')[0].appendChild(link);
    }


    // Find the textarea to use
    if (options.element) {
        this.element = options.element;
    } else if (options.element === null) {
        // This means that the element option was specified, but no element was found
        console.log('EasyMDE: Error. No element was found.');
        return;
    }


    // Handle toolbar
    if (options.toolbar === undefined) {
        // Initialize
        options.toolbar = [];


        // Loop over the built in buttons, to get the preferred order
        for (var key in toolbarBuiltInButtons) {
            if (Object.prototype.hasOwnProperty.call(toolbarBuiltInButtons, key)) {
                if (key.indexOf('separator-') != -1) {
                    options.toolbar.push('|');
                }

                if (toolbarBuiltInButtons[key].default === true || (options.showIcons && options.showIcons.constructor === Array && options.showIcons.indexOf(key) != -1)) {
                    options.toolbar.push(key);
                }
            }
        }
    }

    // Editor preview styling class.
    if (!Object.prototype.hasOwnProperty.call(options, 'previewClass')) {
        options.previewClass = 'editor-preview';
    }

    // Handle status bar
    if (!Object.prototype.hasOwnProperty.call(options, 'status')) {
        options.status = ['autosave', 'lines', 'words', 'cursor'];

        if (options.uploadImage) {
            options.status.unshift('upload-image');
        }
    }


    // Add default preview rendering function
    if (!options.previewRender) {
        options.previewRender = function (plainText) {
            // Note: "this" refers to the options object
            return this.parent.markdown(plainText);
        };
    }


    // Set default options for parsing config
    options.parsingConfig = extend({
        highlightFormatting: true, // needed for toggleCodeBlock to detect types of code
    }, options.parsingConfig || {});


    // Merging the insertTexts, with the given options
    options.insertTexts = extend({}, insertTexts, options.insertTexts || {});


    // Merging the promptTexts, with the given options
    options.promptTexts = extend({}, promptTexts, options.promptTexts || {});


    // Merging the blockStyles, with the given options
    options.blockStyles = extend({}, blockStyles, options.blockStyles || {});


    if (options.autosave != undefined) {
        // Merging the Autosave timeFormat, with the given options
        options.autosave.timeFormat = extend({}, timeFormat, options.autosave.timeFormat || {});
    }

    options.iconClassMap = extend({}, iconClassMap, options.iconClassMap || {});

    // Merging the shortcuts, with the given options
    options.shortcuts = extend({}, shortcuts, options.shortcuts || {});

    options.maxHeight = options.maxHeight || undefined;

    options.direction = options.direction || 'ltr';

    if (typeof options.maxHeight !== 'undefined') {
        // Min and max height are equal if maxHeight is set
        options.minHeight = options.maxHeight;
    } else {
        options.minHeight = options.minHeight || '300px';
    }

    options.errorCallback = options.errorCallback || function (errorMessage) {
        alert(errorMessage);
    };

    // Import-image default configuration
    options.uploadImage = options.uploadImage || false;
    options.imageMaxSize = options.imageMaxSize || 2097152; // 1024 * 1024 * 2
    options.imageAccept = options.imageAccept || 'image/png, image/jpeg, image/gif, image/avif';
    options.imageTexts = extend({}, imageTexts, options.imageTexts || {});
    options.errorMessages = extend({}, errorMessages, options.errorMessages || {});
    options.imagePathAbsolute = options.imagePathAbsolute || false;
    options.imageCSRFName = options.imageCSRFName || 'csrfmiddlewaretoken';
    options.imageCSRFHeader = options.imageCSRFHeader || false;


    // Change unique_id to uniqueId for backwards compatibility
    if (options.autosave != undefined && options.autosave.unique_id != undefined && options.autosave.unique_id != '')
        options.autosave.uniqueId = options.autosave.unique_id;

    // If overlay mode is specified and combine is not provided, default it to true
    if (options.overlayMode && options.overlayMode.combine === undefined) {
        options.overlayMode.combine = true;
    }

    // Update this options
    this.options = options;


    // Auto render
    this.render();


    // The codemirror component is only available after rendering
    // so, the setter for the initialValue can only run after
    // the element has been rendered
    if (options.initialValue && (!this.options.autosave || this.options.autosave.foundSavedValue !== true)) {
        this.value(options.initialValue);
    }

    if (options.uploadImage) {
        var self = this;

        this.codemirror.on('dragenter', function (cm, event) {
            self.updateStatusBar('upload-image', self.options.imageTexts.sbOnDragEnter);
            event.stopPropagation();
            event.preventDefault();
        });
        this.codemirror.on('dragend', function (cm, event) {
            self.updateStatusBar('upload-image', self.options.imageTexts.sbInit);
            event.stopPropagation();
            event.preventDefault();
        });
        this.codemirror.on('dragleave', function (cm, event) {
            self.updateStatusBar('upload-image', self.options.imageTexts.sbInit);
            event.stopPropagation();
            event.preventDefault();
        });

        this.codemirror.on('dragover', function (cm, event) {
            self.updateStatusBar('upload-image', self.options.imageTexts.sbOnDragEnter);
            event.stopPropagation();
            event.preventDefault();
        });

        this.codemirror.on('drop', function (cm, event) {
            event.stopPropagation();
            event.preventDefault();
            if (options.imageUploadFunction) {
                self.uploadImagesUsingCustomFunction(options.imageUploadFunction, event.dataTransfer.files);
            } else {
                self.uploadImages(event.dataTransfer.files);
            }
        });

        this.codemirror.on('paste', function (cm, event) {
            if (options.imageUploadFunction) {
                self.uploadImagesUsingCustomFunction(options.imageUploadFunction, event.clipboardData.files);
            } else {
                self.uploadImages(event.clipboardData.files);
            }
        });
    }
}

/**
 * Upload asynchronously a list of images to a server.
 *
 * Can be triggered by:
 * - drag&drop;
 * - copy-paste;
 * - the browse-file window (opened when the user clicks on the *upload-image* icon).
 * @param {FileList} files The files to upload the the server.
 * @param [onSuccess] {function} see EasyMDE.prototype.uploadImage
 * @param [onError] {function} see EasyMDE.prototype.uploadImage
 */
EasyMDE.prototype.uploadImages = function (files, onSuccess, onError) {
    if (files.length === 0) {
        return;
    }
    var names = [];
    for (var i = 0; i < files.length; i++) {
        names.push(files[i].name);
        this.uploadImage(files[i], onSuccess, onError);
    }
    this.updateStatusBar('upload-image', this.options.imageTexts.sbOnDrop.replace('#images_names#', names.join(', ')));
};

/**
 * Upload asynchronously a list of images to a server.
 *
 * Can be triggered by:
 * - drag&drop;
 * - copy-paste;
 * - the browse-file window (opened when the user clicks on the *upload-image* icon).
 * @param imageUploadFunction {Function} The custom function to upload the image passed in options.
 * @param {FileList} files The files to upload the the server.
 */
EasyMDE.prototype.uploadImagesUsingCustomFunction = function (imageUploadFunction, files) {
    if (files.length === 0) {
        return;
    }
    var names = [];
    for (var i = 0; i < files.length; i++) {
        names.push(files[i].name);
        this.uploadImageUsingCustomFunction(imageUploadFunction, files[i]);
    }
    this.updateStatusBar('upload-image', this.options.imageTexts.sbOnDrop.replace('#images_names#', names.join(', ')));
};

/**
 * Update an item in the status bar.
 * @param itemName {string} The name of the item to update (ie. 'upload-image', 'autosave', etc.).
 * @param content {string} the new content of the item to write in the status bar.
 */
EasyMDE.prototype.updateStatusBar = function (itemName, content) {
    if (!this.gui.statusbar) {
        return;
    }

    var matchingClasses = this.gui.statusbar.getElementsByClassName(itemName);
    if (matchingClasses.length === 1) {
        this.gui.statusbar.getElementsByClassName(itemName)[0].textContent = content;
    } else if (matchingClasses.length === 0) {
        console.log('EasyMDE: status bar item ' + itemName + ' was not found.');
    } else {
        console.log('EasyMDE: Several status bar items named ' + itemName + ' was found.');
    }
};

/**
 * Default markdown render.
 */
EasyMDE.prototype.markdown = function (text) {
    if (marked) {
        // Initialize
        var markedOptions;
        if (this.options && this.options.renderingConfig && this.options.renderingConfig.markedOptions) {
            markedOptions = this.options.renderingConfig.markedOptions;
        } else {
            markedOptions = {};
        }

        // Update options
        if (this.options && this.options.renderingConfig && this.options.renderingConfig.singleLineBreaks === false) {
            markedOptions.breaks = false;
        } else {
            markedOptions.breaks = true;
        }

        if (this.options && this.options.renderingConfig && this.options.renderingConfig.codeSyntaxHighlighting === true) {

            /* Get HLJS from config or window */
            var hljs = this.options.renderingConfig.hljs || window.hljs;

            /* Check if HLJS loaded */
            if (hljs) {
                markedOptions.highlight = function (code, language) {
                    if (language && hljs.getLanguage(language)) {
                        return hljs.highlight(language, code).value;
                    } else {
                        return hljs.highlightAuto(code).value;
                    }
                };
            }
        }

        // Set options
        marked.setOptions(markedOptions);

        // Convert the markdown to HTML
        var htmlText = marked.parse(text);

        // Sanitize HTML
        if (this.options.renderingConfig && typeof this.options.renderingConfig.sanitizerFunction === 'function') {
            htmlText = this.options.renderingConfig.sanitizerFunction.call(this, htmlText);
        }

        // Edit the HTML anchors to add 'target="_blank"' by default.
        htmlText = addAnchorTargetBlank(htmlText);

        // Remove list-style when rendering checkboxes
        htmlText = removeListStyleWhenCheckbox(htmlText);

        return htmlText;
    }
};

/**
 * Render editor to the given element.
 */
EasyMDE.prototype.render = function (el) {
    if (!el) {
        el = this.element || document.getElementsByTagName('textarea')[0];
    }

    if (this._rendered && this._rendered === el) {
        // Already rendered.
        return;
    }

    this.element = el;
    var options = this.options;

    var self = this;
    var keyMaps = {};

    for (var key in options.shortcuts) {
        // null stands for "do not bind this command"
        if (options.shortcuts[key] !== null && bindings[key] !== null) {
            (function (key) {
                keyMaps[fixShortcut(options.shortcuts[key])] = function () {
                    var action = bindings[key];
                    if (typeof action === 'function') {
                        action(self);
                    } else if (typeof action === 'string') {
                        window.open(action, '_blank');
                    }
                };
            })(key);
        }
    }

    keyMaps['Enter'] = 'newlineAndIndentContinueMarkdownList';
    keyMaps['Tab'] = 'tabAndIndentMarkdownList';
    keyMaps['Shift-Tab'] = 'shiftTabAndUnindentMarkdownList';
    keyMaps['Esc'] = function (cm) {
        if (cm.getOption('fullScreen')) toggleFullScreen(self);
    };

    this.documentOnKeyDown = function (e) {
        e = e || window.event;

        if (e.keyCode == 27) {
            if (self.codemirror.getOption('fullScreen')) toggleFullScreen(self);
        }
    };
    document.addEventListener('keydown', this.documentOnKeyDown, false);

    var mode, backdrop;

    // CodeMirror overlay mode
    if (options.overlayMode) {
        CodeMirror.defineMode('overlay-mode', function (config) {
            return CodeMirror.overlayMode(CodeMirror.getMode(config, options.spellChecker !== false ? 'spell-checker' : 'gfm'), options.overlayMode.mode, options.overlayMode.combine);
        });

        mode = 'overlay-mode';
        backdrop = options.parsingConfig;
        backdrop.gitHubSpice = false;
    } else {
        mode = options.parsingConfig;
        mode.name = 'gfm';
        mode.gitHubSpice = false;
    }
    if (options.spellChecker !== false) {
        mode = 'spell-checker';
        backdrop = options.parsingConfig;
        backdrop.name = 'gfm';
        backdrop.gitHubSpice = false;

        if (typeof options.spellChecker === 'function') {
            options.spellChecker({
                codeMirrorInstance: CodeMirror,
            });
        } else {
            CodeMirrorSpellChecker({
                codeMirrorInstance: CodeMirror,
            });
        }
    }

    // eslint-disable-next-line no-unused-vars
    function configureMouse(cm, repeat, event) {
        return {
            addNew: false,
        };
    }

    this.codemirror = CodeMirror.fromTextArea(el, {
        mode: mode,
        backdrop: backdrop,
        theme: (options.theme != undefined) ? options.theme : 'easymde',
        tabSize: (options.tabSize != undefined) ? options.tabSize : 2,
        indentUnit: (options.tabSize != undefined) ? options.tabSize : 2,
        indentWithTabs: (options.indentWithTabs === false) ? false : true,
        lineNumbers: (options.lineNumbers === true) ? true : false,
        autofocus: (options.autofocus === true) ? true : false,
        extraKeys: keyMaps,
        direction: options.direction,
        lineWrapping: (options.lineWrapping === false) ? false : true,
        allowDropFileTypes: ['text/plain'],
        placeholder: options.placeholder || el.getAttribute('placeholder') || '',
        styleSelectedText: (options.styleSelectedText != undefined) ? options.styleSelectedText : !isMobile(),
        scrollbarStyle: (options.scrollbarStyle != undefined) ? options.scrollbarStyle : 'native',
        configureMouse: configureMouse,
        inputStyle: (options.inputStyle != undefined) ? options.inputStyle : isMobile() ? 'contenteditable' : 'textarea',
        spellcheck: (options.nativeSpellcheck != undefined) ? options.nativeSpellcheck : true,
        autoRefresh: (options.autoRefresh != undefined) ? options.autoRefresh : false,
    });

    this.codemirror.getScrollerElement().style.minHeight = options.minHeight;

    if (typeof options.maxHeight !== 'undefined') {
        this.codemirror.getScrollerElement().style.height = options.maxHeight;
    }

    if (options.forceSync === true) {
        var cm = this.codemirror;
        cm.on('change', function () {
            cm.save();
        });
    }

    this.gui = {};

    // Wrap Codemirror with container before create toolbar, etc,
    // to use with sideBySideFullscreen option.
    var easyMDEContainer = document.createElement('div');
    easyMDEContainer.classList.add('EasyMDEContainer');
    easyMDEContainer.setAttribute('role', 'application');
    var cmWrapper = this.codemirror.getWrapperElement();
    cmWrapper.parentNode.insertBefore(easyMDEContainer, cmWrapper);
    easyMDEContainer.appendChild(cmWrapper);

    if (options.toolbar !== false) {
        this.gui.toolbar = this.createToolbar();
    }
    if (options.status !== false) {
        this.gui.statusbar = this.createStatusbar();
    }
    if (options.autosave != undefined && options.autosave.enabled === true) {
        this.autosave(); // use to load localstorage content
        this.codemirror.on('change', function () {
            clearTimeout(self._autosave_timeout);
            self._autosave_timeout = setTimeout(function () {
                self.autosave();
            }, self.options.autosave.submit_delay || self.options.autosave.delay || 1000);
        });
    }

    function calcHeight(naturalWidth, naturalHeight) {
        var height;
        var viewportWidth = window.getComputedStyle(document.querySelector('.CodeMirror-sizer')).width.replace('px', '');
        if (naturalWidth < viewportWidth) {
            height = naturalHeight + 'px';
        } else {
            height = (naturalHeight / naturalWidth * 100) + '%';
        }
        return height;
    }

    var _vm = this;


    function assignImageBlockAttributes(parentEl, img) {
        parentEl.setAttribute('data-img-src', img.url);
        parentEl.setAttribute('style', '--bg-image:url(' + img.url + ');--width:' + img.naturalWidth + 'px;--height:' + calcHeight(img.naturalWidth, img.naturalHeight));
        _vm.codemirror.setSize();
    }

    function handleImages() {
        if (!options.previewImagesInEditor) {
            return;
        }

        easyMDEContainer.querySelectorAll('.cm-image-marker').forEach(function (e) {
            var parentEl = e.parentElement;
            if (!parentEl.innerText.match(/^!\[.*?\]\(.*\)/g)) {
                // if img pasted on the same line with other text, don't preview, preview only images on separate line
                return;
            }
            if (!parentEl.hasAttribute('data-img-src')) {
                var srcAttr = parentEl.innerText.match('\\((.*)\\)'); // might require better parsing according to markdown spec
                if (!window.EMDEimagesCache) {
                    window.EMDEimagesCache = {};
                }

                if (srcAttr && srcAttr.length >= 2) {
                    var keySrc = srcAttr[1];

                    if (options.imagesPreviewHandler) {
                        var newSrc = options.imagesPreviewHandler(srcAttr[1]);
                        // defensive check making sure the handler provided by the user returns a string
                        if (typeof newSrc === 'string') {
                            keySrc = newSrc;
                        }
                    }

                    if (!window.EMDEimagesCache[keySrc]) {
                        var img = document.createElement('img');
                        img.onload = function () {
                            window.EMDEimagesCache[keySrc] = {
                                naturalWidth: img.naturalWidth,
                                naturalHeight: img.naturalHeight,
                                url: keySrc,
                            };
                            assignImageBlockAttributes(parentEl, window.EMDEimagesCache[keySrc]);
                        };
                        img.src = keySrc;
                    } else {
                        assignImageBlockAttributes(parentEl, window.EMDEimagesCache[keySrc]);
                    }
                }
            }
        });
    }

    this.codemirror.on('update', function () {
        handleImages();
    });

    this.gui.sideBySide = this.createSideBySide();
    this._rendered = this.element;

    if (options.autofocus === true || el.autofocus) {
        this.codemirror.focus();
    }

    // Fixes CodeMirror bug (#344)
    var temp_cm = this.codemirror;
    setTimeout(function () {
        temp_cm.refresh();
    }.bind(temp_cm), 0);
};

EasyMDE.prototype.cleanup = function () {
    document.removeEventListener('keydown', this.documentOnKeyDown);
};

// Safari, in Private Browsing Mode, looks like it supports localStorage but all calls to setItem throw QuotaExceededError. We're going to detect this and set a variable accordingly.
function isLocalStorageAvailable() {
    if (typeof localStorage === 'object') {
        try {
            localStorage.setItem('smde_localStorage', 1);
            localStorage.removeItem('smde_localStorage');
        } catch (e) {
            return false;
        }
    } else {
        return false;
    }

    return true;
}

EasyMDE.prototype.autosave = function () {
    if (isLocalStorageAvailable()) {
        var easyMDE = this;

        if (this.options.autosave.uniqueId == undefined || this.options.autosave.uniqueId == '') {
            console.log('EasyMDE: You must set a uniqueId to use the autosave feature');
            return;
        }

        if (this.options.autosave.binded !== true) {
            if (easyMDE.element.form != null && easyMDE.element.form != undefined) {
                easyMDE.element.form.addEventListener('submit', function () {
                    clearTimeout(easyMDE.autosaveTimeoutId);
                    easyMDE.autosaveTimeoutId = undefined;

                    localStorage.removeItem('smde_' + easyMDE.options.autosave.uniqueId);
                });
            }

            this.options.autosave.binded = true;
        }

        if (this.options.autosave.loaded !== true) {
            if (typeof localStorage.getItem('smde_' + this.options.autosave.uniqueId) == 'string' && localStorage.getItem('smde_' + this.options.autosave.uniqueId) != '') {
                this.codemirror.setValue(localStorage.getItem('smde_' + this.options.autosave.uniqueId));
                this.options.autosave.foundSavedValue = true;
            }

            this.options.autosave.loaded = true;
        }

        var value = easyMDE.value();
        if (value !== '') {
            localStorage.setItem('smde_' + this.options.autosave.uniqueId, value);
        } else {
            localStorage.removeItem('smde_' + this.options.autosave.uniqueId);
        }

        var el = document.getElementById('autosaved');
        if (el != null && el != undefined && el != '') {
            var d = new Date();
            var dd = new Intl.DateTimeFormat([this.options.autosave.timeFormat.locale, 'en-US'], this.options.autosave.timeFormat.format).format(d);
            var save = this.options.autosave.text == undefined ? 'Autosaved: ' : this.options.autosave.text;

            el.innerHTML = save + dd;
        }
    } else {
        console.log('EasyMDE: localStorage not available, cannot autosave');
    }
};

EasyMDE.prototype.clearAutosavedValue = function () {
    if (isLocalStorageAvailable()) {
        if (this.options.autosave == undefined || this.options.autosave.uniqueId == undefined || this.options.autosave.uniqueId == '') {
            console.log('EasyMDE: You must set a uniqueId to clear the autosave value');
            return;
        }

        localStorage.removeItem('smde_' + this.options.autosave.uniqueId);
    } else {
        console.log('EasyMDE: localStorage not available, cannot autosave');
    }
};

/**
 * Open the browse-file window to upload an image to a server.
 * @param [onSuccess] {function} see EasyMDE.prototype.uploadImage
 * @param [onError] {function} see EasyMDE.prototype.uploadImage
 */
EasyMDE.prototype.openBrowseFileWindow = function (onSuccess, onError) {
    var self = this;
    var imageInput = this.gui.toolbar.getElementsByClassName('imageInput')[0];
    imageInput.click(); //dispatchEvent(new MouseEvent('click'));  // replaced with click() for IE11 compatibility.
    function onChange(event) {
        if (self.options.imageUploadFunction) {
            self.uploadImagesUsingCustomFunction(self.options.imageUploadFunction, event.target.files);
        } else {
            self.uploadImages(event.target.files, onSuccess, onError);
        }
        imageInput.removeEventListener('change', onChange);
    }

    imageInput.addEventListener('change', onChange);
};

/**
 * Upload an image to the server.
 *
 * @param file {File} The image to upload, as a HTML5 File object (https://developer.mozilla.org/en-US/docs/Web/API/File)
 * @param [onSuccess] {function} A callback function to execute after the image has been successfully uploaded, with one parameter:
 * - url (string): The URL of the uploaded image.
 * @param [onError] {function} A callback function to execute when the image upload fails, with one parameter:
 * - error (string): the detailed error to display to the user (based on messages from options.errorMessages).
 */
EasyMDE.prototype.uploadImage = function (file, onSuccess, onError) {
    var self = this;
    onSuccess = onSuccess || function onSuccess(imageUrl) {
        afterImageUploaded(self, imageUrl);
    };

    function onErrorSup(errorMessage) {
        // show error on status bar and reset after 10000ms
        self.updateStatusBar('upload-image', errorMessage);

        setTimeout(function () {
            self.updateStatusBar('upload-image', self.options.imageTexts.sbInit);
        }, 10000);

        // run custom error handler
        if (onError && typeof onError === 'function') {
            onError(errorMessage);
        }
        // run error handler from options, this alerts the message.
        self.options.errorCallback(errorMessage);
    }

    function fillErrorMessage(errorMessage) {
        var units = self.options.imageTexts.sizeUnits.split(',');
        return errorMessage
            .replace('#image_name#', file.name)
            .replace('#image_size#', humanFileSize(file.size, units))
            .replace('#image_max_size#', humanFileSize(self.options.imageMaxSize, units));
    }

    if (file.size > this.options.imageMaxSize) {
        onErrorSup(fillErrorMessage(this.options.errorMessages.fileTooLarge));
        return;
    }

    var formData = new FormData();
    formData.append('image', file);

    // insert CSRF body token if provided in config.
    if (self.options.imageCSRFToken && !self.options.imageCSRFHeader) {
        formData.append(self.options.imageCSRFName, self.options.imageCSRFToken);
    }

    var request = new XMLHttpRequest();
    request.upload.onprogress = function (event) {
        if (event.lengthComputable) {
            var progress = '' + Math.round((event.loaded * 100) / event.total);
            self.updateStatusBar('upload-image', self.options.imageTexts.sbProgress.replace('#file_name#', file.name).replace('#progress#', progress));
        }
    };
    request.open('POST', this.options.imageUploadEndpoint);

    // insert CSRF header token if provided in config.
    if (self.options.imageCSRFToken && self.options.imageCSRFHeader) {
        request.setRequestHeader(self.options.imageCSRFName, self.options.imageCSRFToken);
    }

    request.onload = function () {
        try {
            var response = JSON.parse(this.responseText);
        } catch (error) {
            console.error('EasyMDE: The server did not return a valid json.');
            onErrorSup(fillErrorMessage(self.options.errorMessages.importError));
            return;
        }
        if (this.status === 200 && response && !response.error && response.data && response.data.filePath) {
            onSuccess((self.options.imagePathAbsolute ? '' : (window.location.origin + '/')) + response.data.filePath);
        } else {
            if (response.error && response.error in self.options.errorMessages) {  // preformatted error message
                onErrorSup(fillErrorMessage(self.options.errorMessages[response.error]));
            } else if (response.error) {  // server side generated error message
                onErrorSup(fillErrorMessage(response.error));
            } else {  //unknown error
                console.error('EasyMDE: Received an unexpected response after uploading the image.'
                    + this.status + ' (' + this.statusText + ')');
                onErrorSup(fillErrorMessage(self.options.errorMessages.importError));
            }
        }
    };

    request.onerror = function (event) {
        console.error('EasyMDE: An unexpected error occurred when trying to upload the image.'
            + event.target.status + ' (' + event.target.statusText + ')');
        onErrorSup(self.options.errorMessages.importError);
    };

    request.send(formData);

};

/**
 * Upload an image to the server using a custom upload function.
 *
 * @param imageUploadFunction {Function} The custom function to upload the image passed in options
 * @param file {File} The image to upload, as a HTML5 File object (https://developer.mozilla.org/en-US/docs/Web/API/File).
 */
EasyMDE.prototype.uploadImageUsingCustomFunction = function (imageUploadFunction, file) {
    var self = this;

    function onSuccess(imageUrl) {
        afterImageUploaded(self, imageUrl);
    }

    function onError(errorMessage) {
        var filledErrorMessage = fillErrorMessage(errorMessage);
        // show error on status bar and reset after 10000ms
        self.updateStatusBar('upload-image', filledErrorMessage);

        setTimeout(function () {
            self.updateStatusBar('upload-image', self.options.imageTexts.sbInit);
        }, 10000);

        // run error handler from options, this alerts the message.
        self.options.errorCallback(filledErrorMessage);
    }

    function fillErrorMessage(errorMessage) {
        var units = self.options.imageTexts.sizeUnits.split(',');
        return errorMessage
            .replace('#image_name#', file.name)
            .replace('#image_size#', humanFileSize(file.size, units))
            .replace('#image_max_size#', humanFileSize(self.options.imageMaxSize, units));
    }

    imageUploadFunction.apply(this, [file, onSuccess, onError]);
};

EasyMDE.prototype.setPreviewMaxHeight = function () {
    var cm = this.codemirror;
    var wrapper = cm.getWrapperElement();
    var preview = wrapper.nextSibling;

    // Calc preview max height
    var paddingTop = parseInt(window.getComputedStyle(wrapper).paddingTop);
    var borderTopWidth = parseInt(window.getComputedStyle(wrapper).borderTopWidth);
    var optionsMaxHeight = parseInt(this.options.maxHeight);
    var wrapperMaxHeight = optionsMaxHeight + paddingTop * 2 + borderTopWidth * 2;
    var previewMaxHeight = wrapperMaxHeight.toString() + 'px';

    preview.style.height = previewMaxHeight;
};

EasyMDE.prototype.createSideBySide = function () {
    var cm = this.codemirror;
    var wrapper = cm.getWrapperElement();
    var preview = wrapper.nextSibling;

    if (!preview || !preview.classList.contains('editor-preview-side')) {
        preview = document.createElement('div');
        preview.className = 'editor-preview-side';

        if (this.options.previewClass) {

            if (Array.isArray(this.options.previewClass)) {
                for (var i = 0; i < this.options.previewClass.length; i++) {
                    preview.classList.add(this.options.previewClass[i]);
                }

            } else if (typeof this.options.previewClass === 'string') {
                preview.classList.add(this.options.previewClass);
            }
        }

        wrapper.parentNode.insertBefore(preview, wrapper.nextSibling);
    }

    if (typeof this.options.maxHeight !== 'undefined') {
        this.setPreviewMaxHeight();
    }

    if (this.options.syncSideBySidePreviewScroll === false) return preview;
    // Syncs scroll  editor -> preview
    var cScroll = false;
    var pScroll = false;
    cm.on('scroll', function (v) {
        if (cScroll) {
            cScroll = false;
            return;
        }
        pScroll = true;
        var height = v.getScrollInfo().height - v.getScrollInfo().clientHeight;
        var ratio = parseFloat(v.getScrollInfo().top) / height;
        var move = (preview.scrollHeight - preview.clientHeight) * ratio;
        preview.scrollTop = move;
    });

    // Syncs scroll  preview -> editor
    preview.onscroll = function () {
        if (pScroll) {
            pScroll = false;
            return;
        }
        cScroll = true;
        var height = preview.scrollHeight - preview.clientHeight;
        var ratio = parseFloat(preview.scrollTop) / height;
        var move = (cm.getScrollInfo().height - cm.getScrollInfo().clientHeight) * ratio;
        cm.scrollTo(0, move);
    };
    return preview;
};

EasyMDE.prototype.createToolbar = function (items) {
    items = items || this.options.toolbar;

    if (!items || items.length === 0) {
        return;
    }
    var i;
    for (i = 0; i < items.length; i++) {
        if (toolbarBuiltInButtons[items[i]] != undefined) {
            items[i] = toolbarBuiltInButtons[items[i]];
        }
    }

    var bar = document.createElement('div');
    bar.className = 'editor-toolbar';
    bar.setAttribute('role', 'toolbar');

    var self = this;

    var toolbarData = {};
    self.toolbar = items;

    for (i = 0; i < items.length; i++) {
        if (items[i].name == 'guide' && self.options.toolbarGuideIcon === false)
            continue;

        if (self.options.hideIcons && self.options.hideIcons.indexOf(items[i].name) != -1)
            continue;

        // Fullscreen does not work well on mobile devices (even tablets)
        // In the future, hopefully this can be resolved
        if ((items[i].name == 'fullscreen' || items[i].name == 'side-by-side') && isMobile())
            continue;


        // Don't include trailing separators
        if (items[i] === '|') {
            var nonSeparatorIconsFollow = false;

            for (var x = (i + 1); x < items.length; x++) {
                if (items[x] !== '|' && (!self.options.hideIcons || self.options.hideIcons.indexOf(items[x].name) == -1)) {
                    nonSeparatorIconsFollow = true;
                }
            }

            if (!nonSeparatorIconsFollow)
                continue;
        }


        // Create the icon and append to the toolbar
        (function (item) {
            var el;
            if (item === '|') {
                el = createSep();
            } else if (item.children) {
                el = createToolbarDropdown(item, self.options.toolbarTips, self.options.shortcuts, self);
            } else {
                el = createToolbarButton(item, true, self.options.toolbarTips, self.options.shortcuts, 'button', self);
            }


            toolbarData[item.name || item] = el;
            bar.appendChild(el);

            // Create the input element (ie. <input type='file'>), used among
            // with the 'import-image' icon to open the browse-file window.
            if (item.name === 'upload-image') {
                var imageInput = document.createElement('input');
                imageInput.className = 'imageInput';
                imageInput.type = 'file';
                imageInput.multiple = true;
                imageInput.name = 'image';
                imageInput.accept = self.options.imageAccept;
                imageInput.style.display = 'none';
                imageInput.style.opacity = 0;
                bar.appendChild(imageInput);
            }
        })(items[i]);
    }

    self.toolbar_div = bar;
    self.toolbarElements = toolbarData;

    var cm = this.codemirror;
    cm.on('cursorActivity', function () {
        var stat = getState(cm);

        for (var key in toolbarData) {
            (function (key) {
                var el = toolbarData[key];
                if (stat[key]) {
                    el.classList.add('active');
                } else if (key != 'fullscreen' && key != 'side-by-side') {
                    el.classList.remove('active');
                }
            })(key);
        }
    });

    var cmWrapper = cm.getWrapperElement();
    cmWrapper.parentNode.insertBefore(bar, cmWrapper);
    return bar;
};

EasyMDE.prototype.createStatusbar = function (status) {
    // Initialize
    status = status || this.options.status;
    var options = this.options;
    var cm = this.codemirror;

    // Make sure the status variable is valid
    if (!status || status.length === 0) {
        return;
    }

    // Set up the built-in items
    var items = [];
    var i, onUpdate, onActivity, defaultValue;

    for (i = 0; i < status.length; i++) {
        // Reset some values
        onUpdate = undefined;
        onActivity = undefined;
        defaultValue = undefined;


        // Handle if custom or not
        if (typeof status[i] === 'object') {
            items.push({
                className: status[i].className,
                defaultValue: status[i].defaultValue,
                onUpdate: status[i].onUpdate,
                onActivity: status[i].onActivity,
            });
        } else {
            var name = status[i];

            if (name === 'words') {
                defaultValue = function (el) {
                    el.innerHTML = wordCount(cm.getValue());
                };
                onUpdate = function (el) {
                    el.innerHTML = wordCount(cm.getValue());
                };
            } else if (name === 'lines') {
                defaultValue = function (el) {
                    el.innerHTML = cm.lineCount();
                };
                onUpdate = function (el) {
                    el.innerHTML = cm.lineCount();
                };
            } else if (name === 'cursor') {
                defaultValue = function (el) {
                    el.innerHTML = '1:1';
                };
                onActivity = function (el) {
                    var pos = cm.getCursor();
                    var posLine = pos.line + 1;
                    var posColumn = pos.ch + 1;
                    el.innerHTML = posLine + ':' + posColumn;
                };
            } else if (name === 'autosave') {
                defaultValue = function (el) {
                    if (options.autosave != undefined && options.autosave.enabled === true) {
                        el.setAttribute('id', 'autosaved');
                    }
                };
            } else if (name === 'upload-image') {
                defaultValue = function (el) {
                    el.innerHTML = options.imageTexts.sbInit;
                };
            }

            items.push({
                className: name,
                defaultValue: defaultValue,
                onUpdate: onUpdate,
                onActivity: onActivity,
            });
        }
    }


    // Create element for the status bar
    var bar = document.createElement('div');
    bar.className = 'editor-statusbar';


    // Create a new span for each item
    for (i = 0; i < items.length; i++) {
        // Store in temporary variable
        var item = items[i];


        // Create span element
        var el = document.createElement('span');
        el.className = item.className;


        // Ensure the defaultValue is a function
        if (typeof item.defaultValue === 'function') {
            item.defaultValue(el);
        }


        // Ensure the onUpdate is a function
        if (typeof item.onUpdate === 'function') {
            // Create a closure around the span of the current action, then execute the onUpdate handler
            this.codemirror.on('update', (function (el, item) {
                return function () {
                    item.onUpdate(el);
                };
            }(el, item)));
        }
        if (typeof item.onActivity === 'function') {
            // Create a closure around the span of the current action, then execute the onActivity handler
            this.codemirror.on('cursorActivity', (function (el, item) {
                return function () {
                    item.onActivity(el);
                };
            }(el, item)));
        }


        // Append the item to the status bar
        bar.appendChild(el);
    }


    // Insert the status bar into the DOM
    var cmWrapper = this.codemirror.getWrapperElement();
    cmWrapper.parentNode.insertBefore(bar, cmWrapper.nextSibling);
    return bar;
};

/**
 * Get or set the text content.
 */
EasyMDE.prototype.value = function (val) {
    var cm = this.codemirror;
    if (val === undefined) {
        return cm.getValue();
    } else {
        cm.getDoc().setValue(val);
        if (this.isPreviewActive()) {
            var wrapper = cm.getWrapperElement();
            var preview = wrapper.lastChild;
            var preview_result = this.options.previewRender(val, preview);
            if (preview_result !== null) {
                preview.innerHTML = preview_result;
            }

        }
        return this;
    }
};


/**
 * Bind static methods for exports.
 */
EasyMDE.toggleBold = toggleBold;
EasyMDE.toggleItalic = toggleItalic;
EasyMDE.toggleStrikethrough = toggleStrikethrough;
EasyMDE.toggleBlockquote = toggleBlockquote;
EasyMDE.toggleHeadingSmaller = toggleHeadingSmaller;
EasyMDE.toggleHeadingBigger = toggleHeadingBigger;
EasyMDE.toggleHeading1 = toggleHeading1;
EasyMDE.toggleHeading2 = toggleHeading2;
EasyMDE.toggleHeading3 = toggleHeading3;
EasyMDE.toggleHeading4 = toggleHeading4;
EasyMDE.toggleHeading5 = toggleHeading5;
EasyMDE.toggleHeading6 = toggleHeading6;
EasyMDE.toggleCodeBlock = toggleCodeBlock;
EasyMDE.toggleUnorderedList = toggleUnorderedList;
EasyMDE.toggleOrderedList = toggleOrderedList;
EasyMDE.cleanBlock = cleanBlock;
EasyMDE.drawLink = drawLink;
EasyMDE.drawImage = drawImage;
EasyMDE.drawUploadedImage = drawUploadedImage;
EasyMDE.drawTable = drawTable;
EasyMDE.drawHorizontalRule = drawHorizontalRule;
EasyMDE.undo = undo;
EasyMDE.redo = redo;
EasyMDE.togglePreview = togglePreview;
EasyMDE.toggleSideBySide = toggleSideBySide;
EasyMDE.toggleFullScreen = toggleFullScreen;

/**
 * Bind instance methods for exports.
 */
EasyMDE.prototype.toggleBold = function () {
    toggleBold(this);
};
EasyMDE.prototype.toggleItalic = function () {
    toggleItalic(this);
};
EasyMDE.prototype.toggleStrikethrough = function () {
    toggleStrikethrough(this);
};
EasyMDE.prototype.toggleBlockquote = function () {
    toggleBlockquote(this);
};
EasyMDE.prototype.toggleHeadingSmaller = function () {
    toggleHeadingSmaller(this);
};
EasyMDE.prototype.toggleHeadingBigger = function () {
    toggleHeadingBigger(this);
};
EasyMDE.prototype.toggleHeading1 = function () {
    toggleHeading1(this);
};
EasyMDE.prototype.toggleHeading2 = function () {
    toggleHeading2(this);
};
EasyMDE.prototype.toggleHeading3 = function () {
    toggleHeading3(this);
};
EasyMDE.prototype.toggleHeading4 = function () {
    toggleHeading4(this);
};
EasyMDE.prototype.toggleHeading5 = function () {
    toggleHeading5(this);
};
EasyMDE.prototype.toggleHeading6 = function () {
    toggleHeading6(this);
};
EasyMDE.prototype.toggleCodeBlock = function () {
    toggleCodeBlock(this);
};
EasyMDE.prototype.toggleUnorderedList = function () {
    toggleUnorderedList(this);
};
EasyMDE.prototype.toggleOrderedList = function () {
    toggleOrderedList(this);
};
EasyMDE.prototype.cleanBlock = function () {
    cleanBlock(this);
};
EasyMDE.prototype.drawLink = function () {
    drawLink(this);
};
EasyMDE.prototype.drawImage = function () {
    drawImage(this);
};
EasyMDE.prototype.drawUploadedImage = function () {
    drawUploadedImage(this);
};
EasyMDE.prototype.drawTable = function () {
    drawTable(this);
};
EasyMDE.prototype.drawHorizontalRule = function () {
    drawHorizontalRule(this);
};
EasyMDE.prototype.undo = function () {
    undo(this);
};
EasyMDE.prototype.redo = function () {
    redo(this);
};
EasyMDE.prototype.togglePreview = function () {
    togglePreview(this);
};
EasyMDE.prototype.toggleSideBySide = function () {
    toggleSideBySide(this);
};
EasyMDE.prototype.toggleFullScreen = function () {
    toggleFullScreen(this);
};

EasyMDE.prototype.isPreviewActive = function () {
    var cm = this.codemirror;
    var wrapper = cm.getWrapperElement();
    var preview = wrapper.lastChild;

    return preview.classList.contains('editor-preview-active');
};

EasyMDE.prototype.isSideBySideActive = function () {
    var cm = this.codemirror;
    var wrapper = cm.getWrapperElement();
    var preview = wrapper.nextSibling;

    return preview.classList.contains('editor-preview-active-side');
};

EasyMDE.prototype.isFullscreenActive = function () {
    var cm = this.codemirror;

    return cm.getOption('fullScreen');
};

EasyMDE.prototype.getState = function () {
    var cm = this.codemirror;

    return getState(cm);
};

EasyMDE.prototype.toTextArea = function () {
    var cm = this.codemirror;
    var wrapper = cm.getWrapperElement();
    var easyMDEContainer = wrapper.parentNode;

    if (easyMDEContainer) {
        if (this.gui.toolbar) {
            easyMDEContainer.removeChild(this.gui.toolbar);
        }
        if (this.gui.statusbar) {
            easyMDEContainer.removeChild(this.gui.statusbar);
        }
        if (this.gui.sideBySide) {
            easyMDEContainer.removeChild(this.gui.sideBySide);
        }
    }

    // Unwrap easyMDEcontainer before codemirror toTextArea() call
    easyMDEContainer.parentNode.insertBefore(wrapper, easyMDEContainer);
    easyMDEContainer.remove();

    cm.toTextArea();

    if (this.autosaveTimeoutId) {
        clearTimeout(this.autosaveTimeoutId);
        this.autosaveTimeoutId = undefined;
        this.clearAutosavedValue();
    }
};
