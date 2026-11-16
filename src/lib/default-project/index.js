import projectData from './project-data';

/* eslint-disable import/no-unresolved */
import hootWav from '!arraybuffer-loader!./d9e233bcc4ae423dffebd2027a59019f.wav?';
import backdrop from '!raw-loader!./cd21514d0531fdffb22204e0ec5ed84a.svg?';
import corujaSvg from '!raw-loader!./f5f2cfb7a7c2b68338e584543145b416.svg?';
/* eslint-enable import/no-unresolved */

const defaultProject = translator => {
    let _TextEncoder;
    if (typeof TextEncoder === 'undefined') {
        _TextEncoder = require('fastestsmallesttextencoderdecoder').TextEncoder;
    } else {
        _TextEncoder = TextEncoder;
    }
    const encoder = new _TextEncoder();

    const projectJson = projectData(translator);
    return [{
        id: 0,
        assetType: 'Project',
        dataFormat: 'JSON',
        data: JSON.stringify(projectJson)
    }, {
        id: 'd9e233bcc4ae423dffebd2027a59019f',
        assetType: 'Sound',
        dataFormat: 'WAV',
        data: new Uint8Array(hootWav)
    }, {
        id: 'cd21514d0531fdffb22204e0ec5ed84a',
        assetType: 'ImageVector',
        dataFormat: 'SVG',
        data: encoder.encode(backdrop)
    }, {
        id: 'f5f2cfb7a7c2b68338e584543145b416',
        assetType: 'ImageVector',
        dataFormat: 'SVG',
        data: encoder.encode(corujaSvg)
    }];
};

export default defaultProject;
