'use strict';

//
// Lambda to handle the following oauth events:
// * generateauthurl
// * generatetoken
// * refreshtoken

//  Load modules
const {google} = require('googleapis'); // Used by all
const oauth2 = google.oauth2('v2'); // Used by generatetoken
const createResponseObject = require('create-response-object'); // Used by all

// Instantiate
// oauth2Client is used by all three handlers and is initiated only if it doesn't already exist.
// This speeds up execution time when the container is still active.
var oauth2Client = {};

// instantiateOauth2Client
// Checks if the oauth2Client is already instantiated
// If not, it instantiates a new one.
// @param {string} redirectUrl - URL the login request will be redirected to
// @return {promise} - Error or response object
function instantiateOauth2Client(redirectUrl) {
  return new Promise(async (resolve,reject) => {

    if(typeof oauth2Client == 'object') {
      console.debug('oauth2Client is an object');
      console.debug(JSON.stringify(oauth2Client,null,2)); // DEBUG:
      await Promise.all([
          oauth2Client._clientId,
          oauth2Client._clientSecret,
          oauth2Client.redirectUri
      ].map(async (avar) => await validateRequiredVar(avar)))
      .then(() => {
        console.debug('instantiateOauth2Client(): oauth2Client is already instantiated.');
        return resolve();
      })  // End Promise.all.then
      .catch(async (err) => {
        // Not really an error, but the oauth2Client doesn't exist yet.
        console.error('instantiateOauth2Client(): Promise.all.catch: ',err);
        console.debug('instantiateOauth2Client(): oauth2Client does not exist, instantiating...');

        // First, validate that CLIENTID and CLIENTSECRET env vars are set
        // Joshua makes a great argument for these checks being unecessary.
        // The idea is that if a var is missing, the function that requires it will
        // Throw an Error which will be caught and close down the Lambda.
        // Google doesn't believe in this theory, their functions will happily execute
        // without the necessary parameters, they'll even return something.
        // I say "something" because whatever is returned may or may not be useful.
        // As a result, we need to check for these env vars.
        await Promise.all([
          process.env.CLIENTID,
          process.env.CLIENTSECRET
        ].map(async (avar) => await validateRequiredVar(avar)))
        .then(() => {
          // Required Env Vars validated, create the oauth2 client
          console.debug('instantiateOauth2Client(): CLIENTID and CLIENTSECRET exist.');
          oauth2Client = new google.auth.OAuth2(
            process.env.CLIENTID,
            process.env.CLIENTSECRET,
            redirectUrl
          );
          return resolve();
        }) // End Promise.all.then
        .catch((err) => {
          // One of the required env vars aren't set.
          console.error(err);
          return reject(err);
        }); // End Promise.all.catch (env vars)

      }); // End Promise.all.catch  (oauth2Client already an object)
    } // End if oauth2Client is object
  }); // End Promise
} // End getOauthClient

// getRedirectURL
// Check if event.origin matches one of the redirectUrls included in env vars
// @param {string} origin - event.origin that called the APIG that triggered this lambda
// @return {Promise} - Error or response object (redirectUrl).
function getRedirectURL(origin) {
  return new Promise(async (resolve, reject) => {

    // Check that REDIRECTURLS are set, otherwise this throws the wrong kind of error.
    await validateRequiredVar(process.env.REDIRECTURLS)
    .then(async () => {
      console.debug('getRedirectURL: env.REDIRECTURLS validated.');

      // Because javascript's indexOf() will find an empty string in any string,
      // Test for that first and rpl with null
      origin = (typeof origin === 'string' && origin.length > 0)
             ? origin
             : null;

      // Check for redir url
      const redir = process.env.REDIRECTURLS.split(' ').find(elem => elem.indexOf(origin) != -1);
      console.debug(`getRedirectURL:redir:: ${redir}`); // DEBUG:
      await validateRequiredVar(redir)
      .then(() => {
        console.debug(`getRedirectURL:redir found.`); // DEBUG:
        return resolve(redir);
      })
      .catch((err) => {
        console.error(`getRedirectURL:origin:: ${origin} does not match any redirectURLs.`,err); // error
        return reject(new Error('Origin does not match supplied redirect URLs.'));
      });

    })  // End valdateRequiredVar(process.env.REDIRECTURLS).then
    .catch((err) => {
      console.error(`getRedirectURL():Error: `,err);
      return reject(err);
    }); // End valdateRequiredVar(process.env.REDIRECTURLS).catch

  }); // End Promise
} // End getRedirectURL

// validateRequiredVar
// Checks if the supplied variable is of type string and has length
// @param {var} reqvar - the variable to check
// @return {promise} - Error or response object
function validateRequiredVar(reqvar) {
  return new Promise((resolve,reject) => {
    // Is the envar a string and have some length?
    if(typeof reqvar === 'string' && reqvar.length > 0) {
      return resolve();
    } else {
      return reject(new Error('Missing Required Variable'));
    }
  }); // End Promise
} // End validateRequiredvar

// validateIP
// Checks if the request should be restricted by IP, and if so, is the request coming from an accepted IP
// @param {string} ip - the IP to check
// @return {promise} - Error or response object
function validateIP(ip) {
  return new Promise(async (resolve,reject) => {
    // Check if RESTRICTTOIPS is set, otherwise allow all IPs
    await validateRequiredVar(process.env.RESTRICTTOIPS)
    .then(() => {
      // I cannot take credit for the following regex, attribution to:
      // https://digitalfortress.tech/tricks/top-15-commonly-used-regex/
      const ipregex = /((^\s*((([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5]))\s*$)|(^\s*((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(%.+)?\s*$))/;
      // check if the ip provided is valid
      if(ipregex.test(ip)) {
        console.debug(`validateIP:ip:: ${ip} is valid.`); // DEBUG:
        // Check if the IP is on the guest list
        if(process.env.RESTRICTTOIPS.split(' ').includes(ip)) {
          // The IP is on the list
          console.debug(`valdiateIP:ip:: ${ip} is on the list.`); // DEBUG:
          return resolve();
        } else {
          // The IP is NOT on the list
          console.error(`validateIP:ip:: ${ip} is NOT on the list.`);
          return reject(new Error('IP Invalid')); // Not on the list
        }
      } else {
        console.error(`validateIP:ip:: ${ip} is NOT a valid IP`);
        return reject(new Error('Invalid IP')); // Not a validly formatted IP
      } // End regex test if/else
    })  // End valdiate process.env.RESTRICTTOIPS.then
    .catch((err) => {
      // Not really an error, RESTRICTTOIPS isn't set so return resolve for everybody.
      console.error(`validateIP:RESTRICTTOIPS:: Not set. Not really an `,err);
      return resolve();
    }); // End validate process.env.RESTRICTTOIPS.catch

  }); // End Promise
} // End validateIP

// accountInDomain
// Check if the account is within the specified domain
// @params {object}
// account {string} - an email address
// domain {string} - an email domain including @ eg: @gmail.com
function accountInDomain(params) {
  return new Promise(async (resolve,reject) => {
    // Check if RESTRICTTODOMAINS is set, otherwise allow all domains
    await validateRequiredVar(process.env.RESTRICTTODOMAINS)
    .then(async () => {
      // Login restrictions in effect, check if login domain matches
      // Check if supplied params are valid
      await validateRequiredVar(params?.account)
      .then(async () => {
        if(process.env.RESTRICTTODOMAINS.split(' ').find(elem => new RegExp(elem+'$').test(params.account))) {
          console.debug(`accountInDomain: ${params.account} is an accepted domain.`); // DEBUG:
          return resolve();
        } else {
          console.debug(`accountInDomain: ${params.account} is NOT an accepted domain.`); // DEBUG:
          return reject(new Error('accountInDomain:Error:: The provided account is not in the domain.'));
        }
      }) // End validate params.account.then
      .catch((err) => {
        // Error
        console.error('accountInDomain:Missing required params: ',err,JSON.stringify(params,null,2));
        return reject(new Error('accountInDomain:: account is a required parameter'));
      }); // End validate params.account.catch
    }) // End validate process.env.RESTRICTTODOMAINS.then
    .catch((err) => {
      // Not really an error, RESTRICTTODOMAINS isn't set so return resolve for everybody
      console.error(`accountInDomain:RESTRICTTODOMAINS:: Not set. Not really an `,err);  // DEBUG:
      return resolve();
    }); // End validate process.env.RESTRICTTODOMAINS.catch

  }); // End Promise
} // End accountInDomain

// **********************************
// Beware, here there be handlers...
//
// Ye be warned!!!

// generateauthurl handler
// generate Auth Url for oauth login button
module.exports.generateauthurl = async (event, context, callback) => {
  console.info('Received event:generateauthurl handler: ', JSON.stringify(event,null,2));

  // Get the redirectUrl that matches this event's origin
  return await getRedirectURL(event.headers.origin)
  .then(async (redirectUrl) => {
    await validateIP(event.requestContext.http.sourceIp);
    return redirectUrl;
  })
  .then(async (redirectUrl) => {
    // conjure up an Oauth2Client
    await instantiateOauth2Client(redirectUrl);
  })  // End getRedirectURL.then.then
  .then(async () => {
    let authUrl = oauth2Client.generateAuthUrl({
      // 'online' is default, but 'offline' gets a refresh_token
      access_type: 'offline',
      // userinfo.email scope is to retrieve email address of user attempting to sign in
      scope: 'https://www.googleapis.com/auth/userinfo.email'
    });
    return await createResponseObject('200', authUrl);
  })  // End getRedirectURL.then.then.then
  .catch(async (err) => {
    console.error('generateauthurl handler:error: ',err.message);
    return await createResponseObject('400', err.message);
//    throw new Error(`[400] Shozbotz`);
  }); // End getRedirectURL.catch

}; // End generateauthurl handler

// generatetoken handler
// generate Oauth Token
module.exports.generatetoken = async (event, context) => {
  console.info('Received event:generateauthurl handler: ', JSON.stringify(event,null,2));
  const postObj = JSON.parse(event.body);

  // Get the redirectUrl that matches this event's origin
  return await getRedirectURL(event.headers.origin)
  .then(async (redirectUrl) => {
    // conjure up an Oauth2Client
    await instantiateOauth2Client(redirectUrl);
    // Check if 'code' was provided with the event
    await validateRequiredVar(postObj.code)
    .then(() => {
      console.debug('generatetoken handler: code provided.');
    });
  })  // End getRedirectURL.then
  .then(async () => {
    // Swap google code for google token
    return await oauth2Client.getToken(postObj.code);
  })  // End getRedirectURL.then.then
  .then(async (tokens) => {
    console.debug('generatetoken handler: tokens:'+JSON.stringify(tokens,null,2));
    // Now tokens contains an access_token and an optional refresh_token. Save them.
    await oauth2Client.setCredentials(tokens.tokens);
    return tokens;
  })  // End getRedirectURL.then.then.then
  .then(async (tokens) => {
    // Get email addresses of the user attempting to login.
    // Add userinfo to a new object that also contains tokens.
    return {
      tokens: tokens,
      userinfo: await oauth2.userinfo.get({ auth: oauth2Client })
    };
  })  // End getRedirectURL.then.then.then.then
  .then(async (football) => {
    console.debug('generatetoken handler: football:',JSON.stringify(football,null,2));

    // Check if login is restricted by email address.
    return await accountInDomain({
      account: football.userinfo.data.email
    })
    .then(() => {
      // The account used for login belongs to the specified domain, return the tokens
      football.tokens.admitted=1;
      football.tokens.email=football.userinfo.data.email;
      console.debug(`Login admitted: ${football.userinfo.data.email}`);
      return football.tokens;
    })  // End accountInDomain.then
    // The account used for login is not a member of the specified domain
    .catch((err) => {
      console.debug(`Non ${process.env.RESTRICTTODOMAIN} email address, access denied.`,err);
      return {
        "admitted": 0,
        "errorMessage": `Access denied. Please log out of your Google account in this browser and log back in using your ${process.env.RESTRICTTODOMAIN} account.`
      };
    }); // End accountInDomain.catch
  })  // End getRedirectURL.then.then.then.then.then
  .then(async (tokens) => {
    // Everthing checks out, return the oauth tokens
    console.debug('Tokens returns: ',JSON.stringify(tokens,null,2));
    return await createResponseObject('200', JSON.stringify(tokens,null,2));
  })  // End getRedirectURL.then.then.then.then.then.then...oh man
  .catch(async (err) => {
    console.error('generatetoken handler: error: ',err);
    return await createResponseObject('400', err.toString());
  }); // End getRedirectURL.catch

};  // End generatetoken handler

// refreshtoken handler
// oauth2 refreshAccessToken
module.exports.refreshtoken = async (event, context) => {
  console.info('Received event:refreshtoken handler: ',JSON.stringify(event,null,2));
  const postObj = JSON.parse(event.body);

  // Get the redirectUrl that matches this event's origin
  return await getRedirectURL(event.headers.origin)
  .then(async (redirectUrl) => {
    // conjure up an Oauth2Client
    await instantiateOauth2Client(redirectUrl);
  })  // End getRedirectURL.then
  .then(async () => {
    // Check if 'refreshToken' and 'accessToken' were provided with the event
    await Promise.all([
      postObj.refreshToken,
      postObj.accessToken
    ].map(async (avar) => await validateRequiredVar(avar)))
    .then(() => {
      console.debug('refreshtoken handler: refreshToken and accessToken provided.');
    });
  })  // End getRedirectURL.then.then
  .then(async () => {
    // Set access and refresh tokens in credentials
    // Optionally, remove access_token to force refresh (undocumented feature)
    await oauth2Client.setCredentials({
      // access_token: postObj.accessToken,    // access_token removed to force refresh
      refresh_token: postObj.refreshToken
    });
  }) // End getRedirectURL.then.then.then
  .then(async () => {
    // Request refreshed tokens from Google
    return await oauth2Client.getAccessToken()
    .then(async (tokens) => {
      console.debug('refreshtoken: getAccessToken: tokens: ',JSON.stringify(tokens,null,2));
      if(tokens?.res?.data) {
        // We return all of tokens.res.data, but it's id_token that we're really after
        return tokens.res.data;
      } else {
        throw new Error('The refresh token returned contains no data.');
      }
    });
  })  // End getRedirectURL.then.then.then.then
  .then(async (results) => {
    console.debug('refreshtoken handler: returns: ',JSON.stringify(results,null,2));
    return await createResponseObject('200', JSON.stringify(results,null,2));
  })  // End getRedirectURL.then.then.then.then.then
  .catch(async (err) => {
    console.error('refreshtoken handler: error: ',err);
    return await createResponseObject('400', err.toString());
  }); // End getRedirectURL.catch
};  // End refreshtoken handler
