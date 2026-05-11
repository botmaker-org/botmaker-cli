const CaType = Object.freeze({
  USER: 'USER',
  ENDPOINT: 'ENDPOINT',
  AI_FUNCTION: 'AI_FUNCTION',
  SCHEDULE: 'SCHEDULE',
});

const getTypeFolder = (type) => {
  if (type === CaType.ENDPOINT) return 'endpoint';
  if (type === CaType.AI_FUNCTION) return 'mcp';
  if (type === CaType.USER) return 'user';
  if (type === CaType.SCHEDULE) return 'schedule';
  return null;
};

const TYPE_FOLDERS = ['user', 'endpoint', 'mcp', 'schedule'];

const cleanFolder = (folder) => (folder || '').replace(/^\/+|\/+$/g, '');

const buildLocalRelPath = (type, folder, basename) => {
  const typeFolder = getTypeFolder(type);
  const f = cleanFolder(folder);
  const segments = typeFolder
    ? ['src', typeFolder, f, basename]
    : [f, basename];
  return segments.filter(Boolean).join('/');
};

const extractFolderFromFilename = (filename, type) => {
  if (!filename) return '';
  const parts = filename.split('/').filter(Boolean);
  if (parts.length === 0) return '';
  const typeFolder = getTypeFolder(type);
  if (typeFolder) {
    if (parts[0] === 'src' && parts[1] === typeFolder) {
      return parts.slice(2, -1).join('/');
    }
    if (parts[0] === typeFolder) {
      return parts.slice(1, -1).join('/');
    }
  }
  return parts.slice(0, -1).join('/');
};

const extractBasename = (filename) => {
  if (!filename) return '';
  const parts = filename.split('/').filter(Boolean);
  return parts[parts.length - 1] || '';
};

module.exports = Object.assign({}, CaType, {
  getTypeFolder,
  buildLocalRelPath,
  extractFolderFromFilename,
  extractBasename,
  TYPE_FOLDERS,
});
