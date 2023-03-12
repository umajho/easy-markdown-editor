import { EditorFromTextArea, Position } from 'codemirror';

interface State {
    bold?: boolean
    quote?: boolean
    italic?: boolean
    strikethrough?: boolean
    code?: boolean
    link?: boolean
    image?: boolean
}

/**
 * The state of CodeMirror at the given position.
 */
export function getState(cm: EditorFromTextArea, pos?: Position): State {
    pos = pos || cm.getCursor('start');
    const stat = cm.getTokenAt(pos);
    if (!stat.type) return {};

    const types = stat.type.split(' ');

    const ret: State = {};
    let data: string, text: string;
    for (var i = 0; i < types.length; i++) {
        data = types[i];
        if (data === 'strong') {
            ret.bold = true;
        } else if (data === 'variable-2') {
            text = cm.getLine(pos.line);
            if (/^\s*\d+\.\s/.test(text)) {
                ret['ordered-list'] = true;
            } else {
                ret['unordered-list'] = true;
            }
        } else if (data === 'atom') {
            ret.quote = true;
        } else if (data === 'em') {
            ret.italic = true;
        } else if (data === 'quote') {
            ret.quote = true;
        } else if (data === 'strikethrough') {
            ret.strikethrough = true;
        } else if (data === 'comment') {
            ret.code = true;
        } else if (data === 'link' && !ret.image) {
            ret.link = true;
        } else if (data === 'image') {
            ret.image = true;
        } else if (data.match(/^header(-[1-6])?$/)) {
            ret[data.replace('header', 'heading')] = true;
        }
    }
    return ret;
}
