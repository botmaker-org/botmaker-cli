const CaType = Object.freeze({
  USER: 'USER',
  ENDPOINT: 'ENDPOINT',
  AI_FUNCTION: 'AI_FUNCTION',
});

const getTypeFolder = (type) => {
  if (type === CaType.ENDPOINT) return 'endpoint';
  if (type === CaType.AI_FUNCTION) return 'mcp';
  return 'user';
};

module.exports = Object.assign({}, CaType, { getTypeFolder });
