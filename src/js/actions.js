import { getState } from './cm-utils';

// Saved overflow setting
var saved_overflow = '';

/**
 * Toggle full screen of the editor.
 * @param {EasyMDE} editor
 */
export function toggleFullScreen(editor) {
    // Set fullscreen
    var cm = editor.codemirror;
    cm.setOption('fullScreen', !cm.getOption('fullScreen'));


    // Prevent scrolling on body during fullscreen active
    if (cm.getOption('fullScreen')) {
        saved_overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
    } else {
        document.body.style.overflow = saved_overflow;
    }

    var wrapper = cm.getWrapperElement();
    var sidebyside = wrapper.nextSibling;

    if (sidebyside.classList.contains('editor-preview-active-side')) {
        if (editor.options.sideBySideFullscreen === false) {
            // if side-by-side not-fullscreen ok, apply classes as needed
            var easyMDEContainer = wrapper.parentNode;
            if (cm.getOption('fullScreen')) {
                easyMDEContainer.classList.remove('sided--no-fullscreen');
            } else {
                easyMDEContainer.classList.add('sided--no-fullscreen');
            }
        } else {
            toggleSideBySide(editor);
        }
    }

    if (editor.options.onToggleFullScreen) {
        editor.options.onToggleFullScreen(cm.getOption('fullScreen') || false);
    }

    // Remove or set maxHeight
    if (typeof editor.options.maxHeight !== 'undefined') {
        if (cm.getOption('fullScreen')) {
            cm.getScrollerElement().style.removeProperty('height');
            sidebyside.style.removeProperty('height');
        } else {
            cm.getScrollerElement().style.height = editor.options.maxHeight;
            editor.setPreviewMaxHeight();
        }
    }

    // Update toolbar class
    editor.toolbar_div.classList.toggle('fullscreen');

    // Update toolbar button
    if (editor.toolbarElements && editor.toolbarElements.fullscreen) {
        var toolbarButton = editor.toolbarElements.fullscreen;
        toolbarButton.classList.toggle('active');
    }
}


/**
 * Action for toggling bold.
 * @param {EasyMDE} editor
 */
export function toggleBold(editor) {
    _toggleBlock(editor, 'bold', editor.options.blockStyles.bold);
}


/**
 * Action for toggling italic.
 * @param {EasyMDE} editor
 */
export function toggleItalic(editor) {
    _toggleBlock(editor, 'italic', editor.options.blockStyles.italic);
}


/**
 * Action for toggling strikethrough.
 * @param {EasyMDE} editor
 */
export function toggleStrikethrough(editor) {
    _toggleBlock(editor, 'strikethrough', '~~');
}

/**
 * Action for toggling code block.
 * @param {EasyMDE} editor
 */
export function toggleCodeBlock(editor) {
    var fenceCharsToInsert = editor.options.blockStyles.code;

    function fencing_line(line) {
        /* return true, if this is a ``` or ~~~ line */
        if (typeof line !== 'object') {
            throw 'fencing_line() takes a \'line\' object (not a line number, or line text).  Got: ' + typeof line + ': ' + line;
        }
        return line.styles && line.styles[2] && line.styles[2].indexOf('formatting-code-block') !== -1;
    }

    function token_state(token) {
        // base goes an extra level deep when mode backdrops are used, e.g. spellchecker on
        return token.state.base.base || token.state.base;
    }

    function code_type(cm, line_num, line, firstTok, lastTok) {
        /*
         * Return "single", "indented", "fenced" or false
         *
         * cm and line_num are required.  Others are optional for efficiency
         *   To check in the middle of a line, pass in firstTok yourself.
         */
        line = line || cm.getLineHandle(line_num);
        firstTok = firstTok || cm.getTokenAt({
            line: line_num,
            ch: 1,
        });
        lastTok = lastTok || (!!line.text && cm.getTokenAt({
            line: line_num,
            ch: line.text.length - 1,
        }));
        var types = firstTok.type ? firstTok.type.split(' ') : [];
        if (lastTok && token_state(lastTok).indentedCode) {
            // have to check last char, since first chars of first line aren"t marked as indented
            return 'indented';
        } else if (types.indexOf('comment') === -1) {
            // has to be after "indented" check, since first chars of first indented line aren"t marked as such
            return false;
        } else if (token_state(firstTok).fencedChars || token_state(lastTok).fencedChars || fencing_line(line)) {
            return 'fenced';
        } else {
            return 'single';
        }
    }

    function insertFencingAtSelection(cm, cur_start, cur_end, fenceCharsToInsert) {
        var start_line_sel = cur_start.line + 1,
            end_line_sel = cur_end.line + 1,
            sel_multi = cur_start.line !== cur_end.line,
            repl_start = fenceCharsToInsert + '\n',
            repl_end = '\n' + fenceCharsToInsert;
        if (sel_multi) {
            end_line_sel++;
        }
        // handle last char including \n or not
        if (sel_multi && cur_end.ch === 0) {
            repl_end = fenceCharsToInsert + '\n';
            end_line_sel--;
        }
        _replaceSelection(cm, false, [repl_start, repl_end]);
        cm.setSelection({
            line: start_line_sel,
            ch: 0,
        }, {
            line: end_line_sel,
            ch: 0,
        });
    }

    var cm = editor.codemirror,
        cur_start = cm.getCursor('start'),
        cur_end = cm.getCursor('end'),
        tok = cm.getTokenAt({
            line: cur_start.line,
            ch: cur_start.ch || 1,
        }), // avoid ch 0 which is a cursor pos but not token
        line = cm.getLineHandle(cur_start.line),
        is_code = code_type(cm, cur_start.line, line, tok);
    var block_start, block_end, lineCount;

    if (is_code === 'single') {
        // similar to some EasyMDE _toggleBlock logic
        var start = line.text.slice(0, cur_start.ch).replace('`', ''),
            end = line.text.slice(cur_start.ch).replace('`', '');
        cm.replaceRange(start + end, {
            line: cur_start.line,
            ch: 0,
        }, {
            line: cur_start.line,
            ch: 99999999999999,
        });
        cur_start.ch--;
        if (cur_start !== cur_end) {
            cur_end.ch--;
        }
        cm.setSelection(cur_start, cur_end);
        cm.focus();
    } else if (is_code === 'fenced') {
        if (cur_start.line !== cur_end.line || cur_start.ch !== cur_end.ch) {
            // use selection

            // find the fenced line so we know what type it is (tilde, backticks, number of them)
            for (block_start = cur_start.line; block_start >= 0; block_start--) {
                line = cm.getLineHandle(block_start);
                if (fencing_line(line)) {
                    break;
                }
            }
            var fencedTok = cm.getTokenAt({
                line: block_start,
                ch: 1,
            });
            var fence_chars = token_state(fencedTok).fencedChars;
            var start_text, start_line;
            var end_text, end_line;
            // check for selection going up against fenced lines, in which case we don't want to add more fencing
            if (fencing_line(cm.getLineHandle(cur_start.line))) {
                start_text = '';
                start_line = cur_start.line;
            } else if (fencing_line(cm.getLineHandle(cur_start.line - 1))) {
                start_text = '';
                start_line = cur_start.line - 1;
            } else {
                start_text = fence_chars + '\n';
                start_line = cur_start.line;
            }
            if (fencing_line(cm.getLineHandle(cur_end.line))) {
                end_text = '';
                end_line = cur_end.line;
                if (cur_end.ch === 0) {
                    end_line += 1;
                }
            } else if (cur_end.ch !== 0 && fencing_line(cm.getLineHandle(cur_end.line + 1))) {
                end_text = '';
                end_line = cur_end.line + 1;
            } else {
                end_text = fence_chars + '\n';
                end_line = cur_end.line + 1;
            }
            if (cur_end.ch === 0) {
                // full last line selected, putting cursor at beginning of next
                end_line -= 1;
            }
            cm.operation(function () {
                // end line first, so that line numbers don't change
                cm.replaceRange(end_text, {
                    line: end_line,
                    ch: 0,
                }, {
                    line: end_line + (end_text ? 0 : 1),
                    ch: 0,
                });
                cm.replaceRange(start_text, {
                    line: start_line,
                    ch: 0,
                }, {
                    line: start_line + (start_text ? 0 : 1),
                    ch: 0,
                });
            });
            cm.setSelection({
                line: start_line + (start_text ? 1 : 0),
                ch: 0,
            }, {
                line: end_line + (start_text ? 1 : -1),
                ch: 0,
            });
            cm.focus();
        } else {
            // no selection, search for ends of this fenced block
            var search_from = cur_start.line;
            if (fencing_line(cm.getLineHandle(cur_start.line))) { // gets a little tricky if cursor is right on a fenced line
                if (code_type(cm, cur_start.line + 1) === 'fenced') {
                    block_start = cur_start.line;
                    search_from = cur_start.line + 1; // for searching for "end"
                } else {
                    block_end = cur_start.line;
                    search_from = cur_start.line - 1; // for searching for "start"
                }
            }
            if (block_start === undefined) {
                for (block_start = search_from; block_start >= 0; block_start--) {
                    line = cm.getLineHandle(block_start);
                    if (fencing_line(line)) {
                        break;
                    }
                }
            }
            if (block_end === undefined) {
                lineCount = cm.lineCount();
                for (block_end = search_from; block_end < lineCount; block_end++) {
                    line = cm.getLineHandle(block_end);
                    if (fencing_line(line)) {
                        break;
                    }
                }
            }
            cm.operation(function () {
                cm.replaceRange('', {
                    line: block_start,
                    ch: 0,
                }, {
                    line: block_start + 1,
                    ch: 0,
                });
                cm.replaceRange('', {
                    line: block_end - 1,
                    ch: 0,
                }, {
                    line: block_end,
                    ch: 0,
                });
            });
            cm.focus();
        }
    } else if (is_code === 'indented') {
        if (cur_start.line !== cur_end.line || cur_start.ch !== cur_end.ch) {
            // use selection
            block_start = cur_start.line;
            block_end = cur_end.line;
            if (cur_end.ch === 0) {
                block_end--;
            }
        } else {
            // no selection, search for ends of this indented block
            for (block_start = cur_start.line; block_start >= 0; block_start--) {
                line = cm.getLineHandle(block_start);
                if (line.text.match(/^\s*$/)) {
                    // empty or all whitespace - keep going
                    continue;
                } else {
                    if (code_type(cm, block_start, line) !== 'indented') {
                        block_start += 1;
                        break;
                    }
                }
            }
            lineCount = cm.lineCount();
            for (block_end = cur_start.line; block_end < lineCount; block_end++) {
                line = cm.getLineHandle(block_end);
                if (line.text.match(/^\s*$/)) {
                    // empty or all whitespace - keep going
                    continue;
                } else {
                    if (code_type(cm, block_end, line) !== 'indented') {
                        block_end -= 1;
                        break;
                    }
                }
            }
        }
        // if we are going to un-indent based on a selected set of lines, and the next line is indented too, we need to
        // insert a blank line so that the next line(s) continue to be indented code
        var next_line = cm.getLineHandle(block_end + 1),
            next_line_last_tok = next_line && cm.getTokenAt({
                line: block_end + 1,
                ch: next_line.text.length - 1,
            }),
            next_line_indented = next_line_last_tok && token_state(next_line_last_tok).indentedCode;
        if (next_line_indented) {
            cm.replaceRange('\n', {
                line: block_end + 1,
                ch: 0,
            });
        }

        for (var i = block_start; i <= block_end; i++) {
            cm.indentLine(i, 'subtract'); // TODO: this doesn't get tracked in the history, so can't be undone :(
        }
        cm.focus();
    } else {
        // insert code formatting
        var no_sel_and_starting_of_line = (cur_start.line === cur_end.line && cur_start.ch === cur_end.ch && cur_start.ch === 0);
        var sel_multi = cur_start.line !== cur_end.line;
        if (no_sel_and_starting_of_line || sel_multi) {
            insertFencingAtSelection(cm, cur_start, cur_end, fenceCharsToInsert);
        } else {
            _replaceSelection(cm, false, ['`', '`']);
        }
    }
}

/**
 * Action for toggling blockquote.
 */
export function toggleBlockquote(editor) {
    _toggleLine(editor.codemirror, 'quote');
}

/**
 * Action for toggling heading size: normal -> h1 -> h2 -> h3 -> h4 -> h5 -> h6 -> normal
 */
export function toggleHeadingSmaller(editor) {
    _toggleHeading(editor.codemirror, 'smaller');
}

/**
 * Action for toggling heading size: normal -> h6 -> h5 -> h4 -> h3 -> h2 -> h1 -> normal
 */
export function toggleHeadingBigger(editor) {
    _toggleHeading(editor.codemirror, 'bigger');
}

/**
 * Action for toggling heading size 1
 */
export function toggleHeading1(editor) {
    _toggleHeading(editor.codemirror, undefined, 1);
}

/**
 * Action for toggling heading size 2
 */
export function toggleHeading2(editor) {
    _toggleHeading(editor.codemirror, undefined, 2);
}

/**
 * Action for toggling heading size 3
 */
export function toggleHeading3(editor) {
    _toggleHeading(editor.codemirror, undefined, 3);
}

/**
 * Action for toggling heading size 4
 */
export function toggleHeading4(editor) {
    _toggleHeading(editor.codemirror, undefined, 4);
}

/**
 * Action for toggling heading size 5
 */
export function toggleHeading5(editor) {
    _toggleHeading(editor.codemirror, undefined, 5);
}

/**
 * Action for toggling heading size 6
 */
export function toggleHeading6(editor) {
    _toggleHeading(editor.codemirror, undefined, 6);
}


/**
 * Action for toggling ul.
 */
export function toggleUnorderedList(editor) {
    var cm = editor.codemirror;

    var listStyle = '*'; // Default
    if (['-', '+', '*'].includes(editor.options.unorderedListStyle)) {
        listStyle = editor.options.unorderedListStyle;
    }

    _toggleLine(cm, 'unordered-list', listStyle);
}


/**
 * Action for toggling ol.
 */
export function toggleOrderedList(editor) {
    _toggleLine(editor.codemirror, 'ordered-list');
}

/**
 * Action for clean block (remove headline, list, blockquote code, markers)
 */
export function cleanBlock(editor) {
    _cleanBlock(editor.codemirror);
}

/**
 * Action for drawing a link.
 * @param {EasyMDE} editor
 */
export function drawLink(editor) {
    var options = editor.options;
    var url = 'https://';
    if (options.promptURLs) {
        var result = prompt(options.promptTexts.link, url);
        if (!result) {
            return false;
        }
        url = escapePromptURL(result);
    }
    _toggleLink(editor, 'link', options.insertTexts.link, url);
}

/**
 * Action for drawing an img.
 * @param {EasyMDE} editor
 */
export function drawImage(editor) {
    var options = editor.options;
    var url = 'https://';
    if (options.promptURLs) {
        var result = prompt(options.promptTexts.image, url);
        if (!result) {
            return false;
        }
        url = escapePromptURL(result);
    }
    _toggleLink(editor, 'image', options.insertTexts.image, url);
}

/**
 * Encode and escape URLs to prevent breaking up rendered Markdown links.
 * @param {string} url The url of the link or image
 */
function escapePromptURL(url) {
    return encodeURI(url).replace(/([\\()])/g, '\\$1');
}

/**
 * Action for opening the browse-file window to upload an image to a server.
 * @param {EasyMDE} editor The EasyMDE object
 */
export function drawUploadedImage(editor) {
    // TODO: Draw the image template with a fake url? ie: '![](importing foo.png...)'
    editor.openBrowseFileWindow();
}

/**
 * Action executed after an image have been successfully imported on the server.
 * @param {EasyMDE} editor The EasyMDE object
 * @param {string} url The url of the uploaded image
 */
export function afterImageUploaded(editor, url) {
    var cm = editor.codemirror;
    var stat = getState(cm);
    var options = editor.options;
    var imageName = url.substr(url.lastIndexOf('/') + 1);
    var ext = imageName.substring(imageName.lastIndexOf('.') + 1).replace(/\?.*$/, '').toLowerCase();

    // Check if media is an image
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'apng', 'avif', 'webp'].includes(ext)) {
        _replaceSelection(cm, stat.image, options.insertTexts.uploadedImage, url);
    } else {
        var text_link = options.insertTexts.link;
        text_link[0] = '[' + imageName;
        _replaceSelection(cm, stat.link, text_link, url);
    }

    // show uploaded image filename for 1000ms
    editor.updateStatusBar('upload-image', editor.options.imageTexts.sbOnUploaded.replace('#image_name#', imageName));
    setTimeout(function () {
        editor.updateStatusBar('upload-image', editor.options.imageTexts.sbInit);
    }, 1000);
}

/**
 * Action for drawing a table.
 * @param {EasyMDE} editor
 */
export function drawTable(editor) {
    var cm = editor.codemirror;
    var stat = getState(cm);
    var options = editor.options;
    _replaceSelection(cm, stat.table, options.insertTexts.table);
}

/**
 * Action for drawing a horizontal rule.
 * @param {EasyMDE} editor
 */
export function drawHorizontalRule(editor) {
    var cm = editor.codemirror;
    var stat = getState(cm);
    var options = editor.options;
    _replaceSelection(cm, stat.image, options.insertTexts.horizontalRule);
}


/**
 * Undo action.
 * @param {EasyMDE} editor
 */
export function undo(editor) {
    var cm = editor.codemirror;
    cm.undo();
    cm.focus();
}


/**
 * Redo action.
 * @param {EasyMDE} editor
 */
export function redo(editor) {
    var cm = editor.codemirror;
    cm.redo();
    cm.focus();
}


/**
 * Toggle side by side preview
 * @param {EasyMDE} editor
 */
export function toggleSideBySide(editor) {
    var cm = editor.codemirror;
    var wrapper = cm.getWrapperElement();
    var preview = wrapper.nextSibling;
    var toolbarButton = editor.toolbarElements && editor.toolbarElements['side-by-side'];
    var useSideBySideListener = false;

    var easyMDEContainer = wrapper.parentNode;

    if (preview.classList.contains('editor-preview-active-side')) {
        if (editor.options.sideBySideFullscreen === false) {
            // if side-by-side not-fullscreen ok, remove classes when hiding side
            easyMDEContainer.classList.remove('sided--no-fullscreen');
        }
        preview.classList.remove('editor-preview-active-side');
        if (toolbarButton) toolbarButton.classList.remove('active');
        wrapper.classList.remove('CodeMirror-sided');
    } else {
        // When the preview button is clicked for the first time,
        // give some time for the transition from editor.css to fire and the view to slide from right to left,
        // instead of just appearing.
        setTimeout(function () {
            if (!cm.getOption('fullScreen')) {
                if (editor.options.sideBySideFullscreen === false) {
                    // if side-by-side not-fullscreen ok, add classes when not fullscreen and showing side
                    easyMDEContainer.classList.add('sided--no-fullscreen');
                } else {
                    toggleFullScreen(editor);
                }
            }
            preview.classList.add('editor-preview-active-side');
        }, 1);
        if (toolbarButton) toolbarButton.classList.add('active');
        wrapper.classList.add('CodeMirror-sided');
        useSideBySideListener = true;
    }

    // Hide normal preview if active
    var previewNormal = wrapper.lastChild;
    if (previewNormal.classList.contains('editor-preview-active')) {
        previewNormal.classList.remove('editor-preview-active');
        var toolbar = editor.toolbarElements.preview;
        var toolbar_div = editor.toolbar_div;
        toolbar.classList.remove('active');
        toolbar_div.classList.remove('disabled-for-preview');
    }

    var sideBySideRenderingFunction = function () {
        var newValue = editor.options.previewRender(editor.value(), preview);
        if (newValue != null) {
            preview.innerHTML = newValue;
        }
    };

    if (!cm.sideBySideRenderingFunction) {
        cm.sideBySideRenderingFunction = sideBySideRenderingFunction;
    }

    if (useSideBySideListener) {
        var newValue = editor.options.previewRender(editor.value(), preview);
        if (newValue != null) {
            preview.innerHTML = newValue;
        }
        cm.on('update', cm.sideBySideRenderingFunction);
    } else {
        cm.off('update', cm.sideBySideRenderingFunction);
    }

    // Refresh to fix selection being off (#309)
    cm.refresh();
}


/**
 * Preview action.
 * @param {EasyMDE} editor
 */
export function togglePreview(editor) {
    var cm = editor.codemirror;
    var wrapper = cm.getWrapperElement();
    var toolbar_div = editor.toolbar_div;
    var toolbar = editor.options.toolbar ? editor.toolbarElements.preview : false;
    var preview = wrapper.lastChild;

    // Turn off side by side if needed
    var sidebyside = cm.getWrapperElement().nextSibling;
    if (sidebyside.classList.contains('editor-preview-active-side'))
        toggleSideBySide(editor);

    if (!preview || !preview.classList.contains('editor-preview-full')) {

        preview = document.createElement('div');
        preview.className = 'editor-preview-full';

        if (editor.options.previewClass) {

            if (Array.isArray(editor.options.previewClass)) {
                for (var i = 0; i < editor.options.previewClass.length; i++) {
                    preview.classList.add(editor.options.previewClass[i]);
                }

            } else if (typeof editor.options.previewClass === 'string') {
                preview.classList.add(editor.options.previewClass);
            }
        }

        wrapper.appendChild(preview);
    }

    if (preview.classList.contains('editor-preview-active')) {
        preview.classList.remove('editor-preview-active');
        if (toolbar) {
            toolbar.classList.remove('active');
            toolbar_div.classList.remove('disabled-for-preview');
        }
    } else {
        // When the preview button is clicked for the first time,
        // give some time for the transition from editor.css to fire and the view to slide from right to left,
        // instead of just appearing.
        setTimeout(function () {
            preview.classList.add('editor-preview-active');
        }, 1);
        if (toolbar) {
            toolbar.classList.add('active');
            toolbar_div.classList.add('disabled-for-preview');
        }
    }

    var preview_result = editor.options.previewRender(editor.value(), preview);
    if (preview_result !== null) {
        preview.innerHTML = preview_result;
    }

}

function _replaceSelection(cm, active, startEnd, url) {
    if (cm.getWrapperElement().lastChild.classList.contains('editor-preview-active'))
        return;

    var text;
    var start = startEnd[0];
    var end = startEnd[1];
    var startPoint = {},
        endPoint = {};
    Object.assign(startPoint, cm.getCursor('start'));
    Object.assign(endPoint, cm.getCursor('end'));
    if (url) {
        start = start.replace('#url#', url);  // url is in start for upload-image
        end = end.replace('#url#', url);
    }
    if (active) {
        text = cm.getLine(startPoint.line);
        start = text.slice(0, startPoint.ch);
        end = text.slice(startPoint.ch);
        cm.replaceRange(start + end, {
            line: startPoint.line,
            ch: 0,
        });
    } else {
        text = cm.getSelection();
        cm.replaceSelection(start + text + end);

        startPoint.ch += start.length;
        if (startPoint !== endPoint) {
            endPoint.ch += start.length;
        }
    }
    cm.setSelection(startPoint, endPoint);
    cm.focus();
}


function _toggleHeading(cm, direction, size) {
    if (cm.getWrapperElement().lastChild.classList.contains('editor-preview-active'))
        return;

    var startPoint = cm.getCursor('start');
    var endPoint = cm.getCursor('end');
    for (var i = startPoint.line; i <= endPoint.line; i++) {
        (function (i) {
            var text = cm.getLine(i);
            var currHeadingLevel = text.search(/[^#]/);

            if (direction !== undefined) {
                if (currHeadingLevel <= 0) {
                    if (direction == 'bigger') {
                        text = '###### ' + text;
                    } else {
                        text = '# ' + text;
                    }
                } else if (currHeadingLevel == 6 && direction == 'smaller') {
                    text = text.substr(7);
                } else if (currHeadingLevel == 1 && direction == 'bigger') {
                    text = text.substr(2);
                } else {
                    if (direction == 'bigger') {
                        text = text.substr(1);
                    } else {
                        text = '#' + text;
                    }
                }
            } else {
                if (currHeadingLevel <= 0) {
                    text = '#'.repeat(size) + ' ' + text;
                } else if (currHeadingLevel == size) {
                    text = text.substr(currHeadingLevel + 1);
                } else {
                    text = '#'.repeat(size) + ' ' + text.substr(currHeadingLevel + 1);
                }
            }

            cm.replaceRange(text, {
                line: i,
                ch: 0,
            }, {
                line: i,
                ch: 99999999999999,
            });
        })(i);
    }
    cm.focus();
}


function _toggleLine(cm, name, liststyle) {
    if (cm.getWrapperElement().lastChild.classList.contains('editor-preview-active'))
        return;

    var listRegexp = /^(\s*)(\*|-|\+|\d*\.)(\s+)/;
    var whitespacesRegexp = /^\s*/;

    var stat = getState(cm);
    var startPoint = cm.getCursor('start');
    var endPoint = cm.getCursor('end');
    var repl = {
        'quote': /^(\s*)>\s+/,
        'unordered-list': listRegexp,
        'ordered-list': listRegexp,
    };

    var _getChar = function (name, i) {
        var map = {
            'quote': '>',
            'unordered-list': liststyle,
            'ordered-list': '%%i.',
        };

        return map[name].replace('%%i', i);
    };

    var _checkChar = function (name, char) {
        var map = {
            'quote': '>',
            'unordered-list': '\\' + liststyle,
            'ordered-list': '\\d+.',
        };
        var rt = new RegExp(map[name]);

        return char && rt.test(char);
    };

    var _toggle = function (name, text, untoggleOnly) {
        var arr = listRegexp.exec(text);
        var char = _getChar(name, line);
        if (arr !== null) {
            if (_checkChar(name, arr[2])) {
                char = '';
            }
            text = arr[1] + char + arr[3] + text.replace(whitespacesRegexp, '').replace(repl[name], '$1');
        } else if (untoggleOnly == false) {
            text = char + ' ' + text;
        }
        return text;
    };

    var line = 1;
    for (var i = startPoint.line; i <= endPoint.line; i++) {
        (function (i) {
            var text = cm.getLine(i);
            if (stat[name]) {
                text = text.replace(repl[name], '$1');
            } else {
                // If we're toggling unordered-list formatting, check if the current line
                // is part of an ordered-list, and if so, untoggle that first.
                // Workaround for https://github.com/Ionaru/easy-markdown-editor/issues/92
                if (name == 'unordered-list') {
                    text = _toggle('ordered-list', text, true);
                }
                text = _toggle(name, text, false);
                line += 1;
            }
            cm.replaceRange(text, {
                line: i,
                ch: 0,
            }, {
                line: i,
                ch: 99999999999999,
            });
        })(i);
    }
    cm.focus();
}

/**
 * @param {EasyMDE} editor
 * @param {'link' | 'image'} type
 * @param {string} startEnd
 * @param {string} url
 */
function _toggleLink(editor, type, startEnd, url) {
    if (!editor.codemirror || editor.isPreviewActive()) {
        return;
    }

    var cm = editor.codemirror;
    var stat = getState(cm);
    var active = stat[type];
    if (!active) {
        _replaceSelection(cm, active, startEnd, url);
        return;
    }

    var startPoint = cm.getCursor('start');
    var endPoint = cm.getCursor('end');
    var text = cm.getLine(startPoint.line);
    var start = text.slice(0, startPoint.ch);
    var end = text.slice(startPoint.ch);

    if (type == 'link') {
        start = start.replace(/(.*)[^!]\[/, '$1');
    } else if (type == 'image') {
        start = start.replace(/(.*)!\[$/, '$1');
    }
    end = end.replace(/]\(.*?\)/, '');

    cm.replaceRange(start + end, {
        line: startPoint.line,
        ch: 0,
    }, {
        line: startPoint.line,
        ch: 99999999999999,
    });

    startPoint.ch -= startEnd[0].length;
    if (startPoint !== endPoint) {
        endPoint.ch -= startEnd[0].length;
    }
    cm.setSelection(startPoint, endPoint);
    cm.focus();
}

/**
 * @param {EasyMDE} editor
 */
function _toggleBlock(editor, type, start_chars, end_chars) {
    if (!editor.codemirror || editor.isPreviewActive()) {
        return;
    }

    end_chars = (typeof end_chars === 'undefined') ? start_chars : end_chars;
    var cm = editor.codemirror;
    var stat = getState(cm);

    var text;
    var start = start_chars;
    var end = end_chars;

    var startPoint = cm.getCursor('start');
    var endPoint = cm.getCursor('end');

    if (stat[type]) {
        text = cm.getLine(startPoint.line);
        start = text.slice(0, startPoint.ch);
        end = text.slice(startPoint.ch);
        if (type == 'bold') {
            start = start.replace(/(\*\*|__)(?![\s\S]*(\*\*|__))/, '');
            end = end.replace(/(\*\*|__)/, '');
        } else if (type == 'italic') {
            start = start.replace(/(\*|_)(?![\s\S]*(\*|_))/, '');
            end = end.replace(/(\*|_)/, '');
        } else if (type == 'strikethrough') {
            start = start.replace(/(\*\*|~~)(?![\s\S]*(\*\*|~~))/, '');
            end = end.replace(/(\*\*|~~)/, '');
        }
        cm.replaceRange(start + end, {
            line: startPoint.line,
            ch: 0,
        }, {
            line: startPoint.line,
            ch: 99999999999999,
        });

        if (type == 'bold' || type == 'strikethrough') {
            startPoint.ch -= 2;
            if (startPoint !== endPoint) {
                endPoint.ch -= 2;
            }
        } else if (type == 'italic') {
            startPoint.ch -= 1;
            if (startPoint !== endPoint) {
                endPoint.ch -= 1;
            }
        }
    } else {
        text = cm.getSelection();
        if (type == 'bold') {
            text = text.split('**').join('');
            text = text.split('__').join('');
        } else if (type == 'italic') {
            text = text.split('*').join('');
            text = text.split('_').join('');
        } else if (type == 'strikethrough') {
            text = text.split('~~').join('');
        }
        cm.replaceSelection(start + text + end);

        startPoint.ch += start_chars.length;
        endPoint.ch = startPoint.ch + text.length;
    }

    cm.setSelection(startPoint, endPoint);
    cm.focus();
}

function _cleanBlock(cm) {
    if (cm.getWrapperElement().lastChild.classList.contains('editor-preview-active'))
        return;

    var startPoint = cm.getCursor('start');
    var endPoint = cm.getCursor('end');
    var text;

    for (var line = startPoint.line; line <= endPoint.line; line++) {
        text = cm.getLine(line);
        text = text.replace(/^[ ]*([# ]+|\*|-|[> ]+|[0-9]+(.|\)))[ ]*/, '');

        cm.replaceRange(text, {
            line: line,
            ch: 0,
        }, {
            line: line,
            ch: 99999999999999,
        });
    }
}
