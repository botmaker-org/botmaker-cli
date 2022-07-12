const https = require('https');

module.exports = ((url,urlOptions, data) => {
  return new Promise((resolve, reject) => {
    const req = https.request(url,urlOptions,
      (res) => {
        res.setEncoding('utf8');
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('error', reject);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode <= 299) {

            resolve({statusCode: res.statusCode, headers: res.headers, body: body});
          } else {
            reject('Request failed. status: ' + res.statusCode + ', body: ' + body);
          }
        });
      });
    req.on('error', reject);
    if(data){
      req.write(data, 'UTF-8');
    }
    req.end();
  });
});