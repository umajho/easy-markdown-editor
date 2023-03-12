import { isMac } from './constants';
import { toggleBold, toggleItalic, drawLink, toggleHeadingSmaller, toggleHeadingBigger, drawImage, drawUploadedImage, toggleBlockquote, toggleOrderedList, toggleUnorderedList, toggleCodeBlock, togglePreview, toggleStrikethrough, toggleHeading1, toggleHeading2, toggleHeading3, cleanBlock, drawTable, drawHorizontalRule, undo, redo, toggleSideBySide, toggleFullScreen } from './actions';
import { bindings, getBindingName, fixShortcut } from './bindings';

export var iconClassMap = {
    'bold': 'fa fa-bold',
    'italic': 'fa fa-italic',
    'strikethrough': 'fa fa-strikethrough',
    'heading': 'fa fa-header fa-heading',
    'heading-smaller': 'fa fa-header fa-heading header-smaller',
    'heading-bigger': 'fa fa-header fa-heading header-bigger',
    'heading-1': 'fa fa-header fa-heading header-1',
    'heading-2': 'fa fa-header fa-heading header-2',
    'heading-3': 'fa fa-header fa-heading header-3',
    'code': 'fa fa-code',
    'quote': 'fa fa-quote-left',
    'ordered-list': 'fa fa-list-ol',
    'unordered-list': 'fa fa-list-ul',
    'clean-block': 'fa fa-eraser',
    'link': 'fa fa-link',
    'image': 'fa fa-image',
    'upload-image': 'fa fa-image',
    'table': 'fa fa-table',
    'horizontal-rule': 'fa fa-minus',
    'preview': 'fa fa-eye',
    'side-by-side': 'fa fa-columns',
    'fullscreen': 'fa fa-arrows-alt',
    'guide': 'fa fa-question-circle',
    'undo': 'fa fa-undo',
    'redo': 'fa fa-repeat fa-redo',
};

export var toolbarBuiltInButtons = {
    'bold': {
        name: 'bold',
        action: toggleBold,
        className: iconClassMap['bold'],
        title: 'Bold',
        default: true,
    },
    'italic': {
        name: 'italic',
        action: toggleItalic,
        className: iconClassMap['italic'],
        title: 'Italic',
        default: true,
    },
    'strikethrough': {
        name: 'strikethrough',
        action: toggleStrikethrough,
        className: iconClassMap['strikethrough'],
        title: 'Strikethrough',
    },
    'heading': {
        name: 'heading',
        action: toggleHeadingSmaller,
        className: iconClassMap['heading'],
        title: 'Heading',
        default: true,
    },
    'heading-smaller': {
        name: 'heading-smaller',
        action: toggleHeadingSmaller,
        className: iconClassMap['heading-smaller'],
        title: 'Smaller Heading',
    },
    'heading-bigger': {
        name: 'heading-bigger',
        action: toggleHeadingBigger,
        className: iconClassMap['heading-bigger'],
        title: 'Bigger Heading',
    },
    'heading-1': {
        name: 'heading-1',
        action: toggleHeading1,
        className: iconClassMap['heading-1'],
        title: 'Big Heading',
    },
    'heading-2': {
        name: 'heading-2',
        action: toggleHeading2,
        className: iconClassMap['heading-2'],
        title: 'Medium Heading',
    },
    'heading-3': {
        name: 'heading-3',
        action: toggleHeading3,
        className: iconClassMap['heading-3'],
        title: 'Small Heading',
    },
    'separator-1': {
        name: 'separator-1',
    },
    'code': {
        name: 'code',
        action: toggleCodeBlock,
        className: iconClassMap['code'],
        title: 'Code',
    },
    'quote': {
        name: 'quote',
        action: toggleBlockquote,
        className: iconClassMap['quote'],
        title: 'Quote',
        default: true,
    },
    'unordered-list': {
        name: 'unordered-list',
        action: toggleUnorderedList,
        className: iconClassMap['unordered-list'],
        title: 'Generic List',
        default: true,
    },
    'ordered-list': {
        name: 'ordered-list',
        action: toggleOrderedList,
        className: iconClassMap['ordered-list'],
        title: 'Numbered List',
        default: true,
    },
    'clean-block': {
        name: 'clean-block',
        action: cleanBlock,
        className: iconClassMap['clean-block'],
        title: 'Clean block',
    },
    'separator-2': {
        name: 'separator-2',
    },
    'link': {
        name: 'link',
        action: drawLink,
        className: iconClassMap['link'],
        title: 'Create Link',
        default: true,
    },
    'image': {
        name: 'image',
        action: drawImage,
        className: iconClassMap['image'],
        title: 'Insert Image',
        default: true,
    },
    'upload-image': {
        name: 'upload-image',
        action: drawUploadedImage,
        className: iconClassMap['upload-image'],
        title: 'Import an image',
    },
    'table': {
        name: 'table',
        action: drawTable,
        className: iconClassMap['table'],
        title: 'Insert Table',
    },
    'horizontal-rule': {
        name: 'horizontal-rule',
        action: drawHorizontalRule,
        className: iconClassMap['horizontal-rule'],
        title: 'Insert Horizontal Line',
    },
    'separator-3': {
        name: 'separator-3',
    },
    'preview': {
        name: 'preview',
        action: togglePreview,
        className: iconClassMap['preview'],
        noDisable: true,
        title: 'Toggle Preview',
        default: true,
    },
    'side-by-side': {
        name: 'side-by-side',
        action: toggleSideBySide,
        className: iconClassMap['side-by-side'],
        noDisable: true,
        noMobile: true,
        title: 'Toggle Side by Side',
        default: true,
    },
    'fullscreen': {
        name: 'fullscreen',
        action: toggleFullScreen,
        className: iconClassMap['fullscreen'],
        noDisable: true,
        noMobile: true,
        title: 'Toggle Fullscreen',
        default: true,
    },
    'separator-4': {
        name: 'separator-4',
    },
    'guide': {
        name: 'guide',
        action: 'https://www.markdownguide.org/basic-syntax/',
        className: iconClassMap['guide'],
        noDisable: true,
        title: 'Markdown Guide',
        default: true,
    },
    'separator-5': {
        name: 'separator-5',
    },
    'undo': {
        name: 'undo',
        action: undo,
        className: iconClassMap['undo'],
        noDisable: true,
        title: 'Undo',
    },
    'redo': {
        name: 'redo',
        action: redo,
        className: iconClassMap['redo'],
        noDisable: true,
        title: 'Redo',
    },
};

/**
 * Create dropdown block
 */
export function createToolbarDropdown(options, enableTooltips, shortcuts, parent) {
    var el = createToolbarButton(options, false, enableTooltips, shortcuts, 'button', parent);
    el.classList.add('easymde-dropdown');

    el.onclick = function () {
        el.focus();
    };

    var content = document.createElement('div');
    content.className = 'easymde-dropdown-content';
    for (var childrenIndex = 0; childrenIndex < options.children.length; childrenIndex++) {

        var child = options.children[childrenIndex];
        var childElement;

        if (typeof child === 'string' && child in toolbarBuiltInButtons) {
            childElement = createToolbarButton(toolbarBuiltInButtons[child], true, enableTooltips, shortcuts, 'button', parent);
        } else {
            childElement = createToolbarButton(child, true, enableTooltips, shortcuts, 'button', parent);
        }

        childElement.addEventListener('click', function (e) { e.stopPropagation(); }, false);
        content.appendChild(childElement);
    }
    el.appendChild(content);
    return el;
}

/**
 * Create button element for toolbar.
 */
export function createToolbarButton(options, enableActions, enableTooltips, shortcuts, markup, parent) {
    options = options || {};
    var el = document.createElement(markup);

    // Add 'custom' attributes as early as possible, so that 'official' attributes will never be overwritten.
    if (options.attributes) {
        for (var attribute in options.attributes) {
            if (Object.prototype.hasOwnProperty.call(options.attributes, attribute)) {
                el.setAttribute(attribute, options.attributes[attribute]);
            }
        }
    }

    var classNamePrefix = parent.options.toolbarButtonClassPrefix ? parent.options.toolbarButtonClassPrefix + '-' : '';
    el.className = classNamePrefix + options.name;
    el.setAttribute('type', markup);
    enableTooltips = (enableTooltips == undefined) ? true : enableTooltips;

    if (options.text) {
        el.innerText = options.text;
    }

    // Properly handle custom shortcuts
    if (options.name && options.name in shortcuts) {
        bindings[options.name] = options.action;
    }

    if (options.title && enableTooltips) {
        el.title = createTooltip(options.title, options.action, shortcuts);

        if (isMac) {
            el.title = el.title.replace('Ctrl', '⌘');
            el.title = el.title.replace('Alt', '⌥');
        }
    }

    if (options.title) {
        el.setAttribute('aria-label', options.title);
    }

    if (options.noDisable) {
        el.classList.add('no-disable');
    }

    if (options.noMobile) {
        el.classList.add('no-mobile');
    }

    // Prevent errors if there is no class name in custom options
    var classNameParts = [];
    if (typeof options.className !== 'undefined') {
        classNameParts = options.className.split(' ');
    }

    // Provide backwards compatibility with simple-markdown-editor by adding custom classes to the button.
    var iconClasses = [];
    for (var classNameIndex = 0; classNameIndex < classNameParts.length; classNameIndex++) {
        var classNamePart = classNameParts[classNameIndex];
        // Split icon classes from the button.
        // Regex will detect "fa", "fas", "fa-something" and "fa-some-icon-1", but not "fanfare".
        if (classNamePart.match(/^fa([srlb]|(-[\w-]*)|$)/)) {
            iconClasses.push(classNamePart);
        } else {
            el.classList.add(classNamePart);
        }
    }

    el.tabIndex = -1;

    if (iconClasses.length > 0) {
        // Create icon element and append as a child to the button
        var icon = document.createElement('i');
        for (var iconClassIndex = 0; iconClassIndex < iconClasses.length; iconClassIndex++) {
            var iconClass = iconClasses[iconClassIndex];
            icon.classList.add(iconClass);
        }
        el.appendChild(icon);
    }

    // If there is a custom icon markup set, use that
    if (typeof options.icon !== 'undefined') {
        el.innerHTML = options.icon;
    }

    if (options.action && enableActions) {
        if (typeof options.action === 'function') {
            el.onclick = function (e) {
                e.preventDefault();
                options.action(parent);
            };
        } else if (typeof options.action === 'string') {
            el.onclick = function (e) {
                e.preventDefault();
                window.open(options.action, '_blank');
            };
        }
    }

    return el;
}

export function createSep() {
    var el = document.createElement('i');
    el.className = 'separator';
    el.innerHTML = '|';
    return el;
}

export function createTooltip(title, action, shortcuts) {
    var actionName;
    var tooltip = title;

    if (action) {
        actionName = getBindingName(action);
        if (shortcuts[actionName]) {
            tooltip += ' (' + fixShortcut(shortcuts[actionName]) + ')';
        }
    }

    return tooltip;
}
