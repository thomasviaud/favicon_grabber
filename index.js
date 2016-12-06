const http = require('http');
const https = require('https');
const url = require('url');

const allowedContentTypes = ['image/x-icon', 'image/gif', 'image/jpeg', 'image/png', 'image/tiff', 'image/vnd.microsoft.icon', 'image/svg+xml', 'image/png;charset=UTF-8'];

/*
* Get the favicon with URL and returns a callback.
*/
function getFav(favUrl, callback) {
  let protocol;
  if (/https:\/\//.test(favUrl)) {
    protocol = https;
  } else {
    protocol = http;
  }
  // Get request
  console.log('GET', favUrl);
  protocol.get(favUrl, (res) => {
    const statusCode = res.statusCode;
    const contentType = res.headers['content-type'];
    let error;

    if (statusCode !== 200) {
      // Http to Https redirection
      if (statusCode === 301 || statusCode === 302) {
        getFav(res.headers.location, callback);
        return;
      }
      error = new Error(`[getFav] Request Failed. Status Code: ${statusCode}`);
    } else if (!allowedContentTypes.includes(contentType)) {
      error = new Error(`[getFav] Invalid content-type : ${contentType}`);
    }
    if (error) {
      console.log(error.message);
      callback();
      return;
    }
    // If 200 then we start to download the favicon asynchronously
    let favicon;
    const data = [];
    let length = 0;
    res.on('data', (dataChunk) => {
      data.push(dataChunk);
      length += dataChunk.length;
    }).on('end', () => {
      favicon = Buffer.concat(data, length);
      callback(favicon);
    });
  }).on('error', (err) => {
    console.log(`[Error getFav] : ${err.message}`);
  });
}

/*
* Get HTML page in order to find favicons.
*/
function getPage(pageUrl, callback) {
  let protocol;
  if (/https:\/\//.test(pageUrl)) {
    protocol = https;
  } else {
    protocol = http;
  }
  // Get HTML page asynchronously.
  protocol.get(pageUrl, (res) => {
    const statusCode = res.statusCode;
    let error;
    if (statusCode !== 200) {
      // Http to Https redirection
      if (statusCode === 301 || statusCode === 302) {
        getPage(res.headers.location, callback);
        return;
      }
      error = new Error(`[getPage] Request Failed. Status Code: ${statusCode}`);
    }
    if (error) {
      console.log(error.message);
      callback();
      return;
    }
    let html;
    const data = [];
    res.setEncoding('utf8');
    res.on('data', dataChunk => data.push(dataChunk));
    res.on('end', () => {
      html = data.join('');
      callback(html);
    });
  }).on('error', (err) => {
    console.log(`[Error getPage] : ${err.message}`);
  });
}

/*
* Parse the HTML page to find favicon insertions. Return an array containing all the favicon links.
*/
function parseFav(html, domain) {
  const linkRegExp = /<link ([^>]*)>/gi;
  const relRegExp = /rel=["'][^"]*icon[^"']*["']/i;
  const hrefRegExp = /href=["']([^"']*)["']/i;
  let favUrl;
  const favUrls = [];
  const linkResults = html.match(linkRegExp);
  if (!linkResults) return favUrls;

  for (let i = 0; i < linkResults.length; i += 1) {
    if (relRegExp.test(linkResults[i])) {
      favUrl = hrefRegExp.exec(linkResults[i]);
      if (favUrl[1]) {
        // If starts with '/'
        if (favUrl[1][0] === '/') {
          // If starts with '//', only the protocol is needed
          if (favUrl[1][1] === '/') favUrls.push(`${domain.protocol}${favUrl[1]}`);
          else favUrls.push(`${domain.protocol}//${domain.host}${favUrl[1]}`);
        } else favUrls.push(favUrl[1]);
      }
    }
  }
  return favUrls;
}

/*
* Define a proper domain URL
*/
function completeProtocol(baseDomain) {
  let domain = url.parse(baseDomain);
  let httpProtocol = 'http:';
  if (!domain.protocol) {
    if (baseDomain.slice(0, 2) !== '//') {
      httpProtocol += '//';
    }
    domain = url.parse(`${httpProtocol}${baseDomain}`);
  }
  return domain;
}

/* Server */
const server = http.createServer((request, response) => {
  let favFromUrl;
  let favFromPage;
  let nbNotify = 0;
  const notify = () => {
    nbNotify += 1;
    // If this call is the last method to be returned
    if (nbNotify === 2) {
      let fav;
      if (favFromUrl) fav = favFromUrl;
      else if (favFromPage) fav = favFromPage;
      else {
        response.writeHead(404, { 'Content-Type': 'text/plain' });
        response.end('No favicon found.');
      }
      response.writeHead(200, { 'Content-Type': 'image/x-icon' });
      response.end(fav);
    }
  };
  console.log('REQUEST ==>', request.url);
  let domain = url.parse(request.url, true).query;
  domain = completeProtocol(domain.domain);
  const domainUrl = `${domain.protocol}//${domain.host}`;
  // Getting favicon by direct URL.
  getFav(`${domainUrl}/favicon.ico`, (fav) => {
    if (fav) favFromUrl = fav;
    notify();
  });
  // Getting favicon by HTML page analysis.
  getPage(domainUrl, (html) => {
    if (html) {
      const favUrls = parseFav(html, domain);
      // If we have at least one favicon URL, try to get it.
      if (favUrls.length) {
        console.log(`[getPage] Retrieved favicon Url :\n ${(favUrls)}`);
        getFav(favUrls[0], (fav) => {
          favFromPage = fav;
          notify();
        });
      } else {
        notify();
      }
    }
  });
});
server.listen(8000);
console.log('Server running at http://localhost:8000/');
