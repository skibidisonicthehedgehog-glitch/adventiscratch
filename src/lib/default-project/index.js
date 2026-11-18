import projectData from './project-data';

/* eslint-disable import/no-unresolved */
// "pop": som do ator vazio (botão "Pintar"). Fica embutido para não depender da internet.
import popWav from '!arraybuffer-loader!./83a9787d4cb6f3b7632b4ddfebf74367.wav?';
import backdrop from '!raw-loader!./cd21514d0531fdffb22204e0ec5ed84a.svg?';
import siomCalm from '!raw-loader!./2bd04ed033cdabb560157420f696afc3.svg?';
import siomTensa from '!raw-loader!./54a20f367ba6510055036e7b67b4e092.svg?';
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
        id: '83a9787d4cb6f3b7632b4ddfebf74367',
        assetType: 'Sound',
        dataFormat: 'WAV',
        data: new Uint8Array(popWav)
    }, {
        id: 'cd21514d0531fdffb22204e0ec5ed84a',
        assetType: 'ImageVector',
        dataFormat: 'SVG',
        data: encoder.encode(backdrop)
    }, {
        id: '2bd04ed033cdabb560157420f696afc3',
        assetType: 'ImageVector',
        dataFormat: 'SVG',
        data: encoder.encode(siomCalm)
    }, {
        id: '54a20f367ba6510055036e7b67b4e092',
        assetType: 'ImageVector',
        dataFormat: 'SVG',
        data: encoder.encode(siomTensa)
    }];
};

export default defaultProject;
