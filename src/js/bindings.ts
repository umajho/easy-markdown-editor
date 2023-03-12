import { isMac } from './constants';
import { toggleBold, toggleItalic, drawLink, toggleHeadingSmaller, toggleHeadingBigger, drawImage, toggleBlockquote, toggleOrderedList, toggleUnorderedList, toggleCodeBlock, togglePreview, toggleStrikethrough, toggleHeading1, toggleHeading2, toggleHeading3, toggleHeading4, toggleHeading5, toggleHeading6, cleanBlock, drawTable, drawHorizontalRule, undo, redo, toggleSideBySide, toggleFullScreen } from './actions';

// Mapping of actions that can be bound to keyboard shortcuts or toolbar buttons
export const bindings = {
    'toggleBold': toggleBold,
    'toggleItalic': toggleItalic,
    'drawLink': drawLink,
    'toggleHeadingSmaller': toggleHeadingSmaller,
    'toggleHeadingBigger': toggleHeadingBigger,
    'drawImage': drawImage,
    'toggleBlockquote': toggleBlockquote,
    'toggleOrderedList': toggleOrderedList,
    'toggleUnorderedList': toggleUnorderedList,
    'toggleCodeBlock': toggleCodeBlock,
    'togglePreview': togglePreview,
    'toggleStrikethrough': toggleStrikethrough,
    'toggleHeading1': toggleHeading1,
    'toggleHeading2': toggleHeading2,
    'toggleHeading3': toggleHeading3,
    'toggleHeading4': toggleHeading4,
    'toggleHeading5': toggleHeading5,
    'toggleHeading6': toggleHeading6,
    'cleanBlock': cleanBlock,
    'drawTable': drawTable,
    'drawHorizontalRule': drawHorizontalRule,
    'undo': undo,
    'redo': redo,
    'toggleSideBySide': toggleSideBySide,
    'toggleFullScreen': toggleFullScreen,
};

export const shortcuts = {
    'toggleBold': 'Cmd-B',
    'toggleItalic': 'Cmd-I',
    'drawLink': 'Cmd-K',
    'toggleHeadingSmaller': 'Cmd-H',
    'toggleHeadingBigger': 'Shift-Cmd-H',
    'toggleHeading1': 'Ctrl+Alt+1',
    'toggleHeading2': 'Ctrl+Alt+2',
    'toggleHeading3': 'Ctrl+Alt+3',
    'toggleHeading4': 'Ctrl+Alt+4',
    'toggleHeading5': 'Ctrl+Alt+5',
    'toggleHeading6': 'Ctrl+Alt+6',
    'cleanBlock': 'Cmd-E',
    'drawImage': 'Cmd-Alt-I',
    'toggleBlockquote': 'Cmd-\'',
    'toggleOrderedList': 'Cmd-Alt-L',
    'toggleUnorderedList': 'Cmd-L',
    'toggleCodeBlock': 'Cmd-Alt-C',
    'togglePreview': 'Cmd-P',
    'toggleSideBySide': 'F9',
    'toggleFullScreen': 'F11',
};

export function getBindingName(f) {
    for (const key in bindings) {
        if (bindings[key] === f) {
            return key;
        }
    }
    return null;
}

/**
 * Fix shortcut. Mac use Command, others use Ctrl.
 */
export function fixShortcut(name) {
    if (isMac) {
        name = name.replace('Ctrl', 'Cmd');
    } else {
        name = name.replace('Cmd', 'Ctrl');
    }
    return name;
}
