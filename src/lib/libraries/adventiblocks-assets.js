import assets from './adventiblocks-assets.json';

export const adventiblocksAssetUrl = filename =>
    (assets.includes(filename) ? `static/adventiscratch/atores/${filename}` : null);
