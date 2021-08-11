const https = require('./httpPromise');

const baseUrl = 'https://go.botmaker.com';

exports.getAllCas = async (token) => {
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/x-www-form-urlencoded',
    'access-token': token,
  }
  return await https(`${baseUrl}/api/v1.0/clientAction`, { headers });
}

exports.getCa = async (token, caId) => {
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/x-www-form-urlencoded',
    'access-token': token,
  }
  return await https(`${baseUrl}/api/v1.0/clientAction/${caId}`, { headers });
}

exports.createCa = async (token, newCa) => {
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'access-token': token,
  }
  return await https(
    `${baseUrl}/api/v1.0/clientAction/`, 
    { headers, method: 'POST' },
    JSON.stringify(newCa)
  );
}

exports.updateCas = async (token, toUpdate) => {
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'access-token': token,
  }
  return await https(
    `${baseUrl}/api/v1.0/clientAction/multiple`, 
    { headers, method: 'PUT' },
    JSON.stringify(toUpdate)
  );
}


exports.getCustomerContext = async (token, customerId = 'rnd') => {
  const headers = {
    'access-token': token,
  }
  return await https(`${baseUrl}/api/v1.0/customer/${customerId}/context`, { headers });
}


exports.publishCa = async (token, caId) => {
  const headers = {
    'Accept': 'application/json',
    'access-token': token,
  }
  return await https(`${baseUrl}/api/v1.0/clientAction/${caId}/publish`, { headers, method: 'POST' });
}
