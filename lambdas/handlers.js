'use strict';

//
// Lambda to handle the following oauth events:
// * generateauthurl
// * generatetoken
// * refreshtoken

//  Load modules
const {google} = require('googleapis'); // Used by all
const oauth2 = google.oauth2('v2'); // Used by generatetoken
const createResponseObject = require('createResponseObject'); // Used by all

// Instantiate
// oauth2Client is used by all three handlers and is initiated only if it doesn't already exist.
// This speeds up execution time when the container is still active.
var oauth2Client = {};
var tokens = {};

// instantiateOauth2Client
// Checks if the oauth2Client is already instantiated
// If not, it instantiates a new one.
// @param {string} redirectUrl - URL the login request will be redirected to
// @return {promise} - Error or response object
function instantiateOauth2Client(redirectUrl) {
  return new Promise(async (resolve,reject) => {

    if(typeof oauth2Client == 'object') {
      console.debug('oauth2Client is an object');
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

    // Check that REDIRECTURLs are set, otherwise this throws the wrong kind of error.
    await Promise.all([
      process.env.REDIRECTURL1,
      process.env.REDIRECTURL2
    ].map(async (avar) => validateRequiredVar(avar)))
    .then(() => {
      console.debug('getRedirectURL(): all env vars validated.');

      // Because javascript's indexOf() will find an empty string in any string,
      // Test for that first and rpl with null
      origin = (typeof origin === 'string' && origin.length > 0)
               ? origin
               : null;

      // If this is wrong, I don't want to be right
      switch(true) {
        case process.env.REDIRECTURL1.indexOf(origin) != -1:
          console.debug(`getRedirectURL(): origin matches redirectUrl1`);
          return resolve(process.env.REDIRECTURL1);
        case process.env.REDIRECTURL2.indexOf(origin) != -1:
          console.debug(`getRedirectURL(): origin matches redirectUrl2`);
          return resolve(process.env.REDIRECTURL2);
        default:
          console.error(`getRedirectURL(): origin: ${origin} does not match either redirectUrl.`);
          return reject(new Error(`getRedirectURL() error: Origin does not match either redirectUrl.`));
      } // End switch
    })  // End Promise.all.then
    .catch((err) => {
      console.error(`getRedirectURL():Error: `,err);
      return reject(err);
    }); // End Promise.all.catch

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
} // End validateEnvar

// accountInDomain
// Check if the account is within the specified domain
// @params {object}
// account {string} - an email address
// domain {string} - an email domain including @ eg: @gmail.com
function accountInDomain(params) {
  return new Promise((resolve,reject) => {
    // check supplied params are valid
    if( !params.account || params.account.length == 0
        || !params.domain || params.domain.length == 0) {
          console.error('accountInDomain(): missing required params:',JSON.stringify(params,null,2));
          return reject(new Error('accountInDomain() Error: account and domain are required parameters'));
        }
    if( params.account.indexOf(params.domain) > -1) {
      console.debug(`accountInDomain(): ${params.account} is in ${params.domain}`);
      return resolve();
    } else {
      console.debug(`accountInDomain(): ${params.account} is NOT in ${params.domain}`);
      return reject(new Error('accountInDomain() Error: The provided account is not in the domain.'));
    }
  }); // End Promise
} // End accountInDomain

// **********************************
// Beware, here there be handlers...
//
// Ye be warned!!!

// generateauthurl
// generate Auth Url for oauth login button
module.exports.generateauthurl = async (event, context, callback) => {
  console.info('Received event:generateauthurl handler: ', JSON.stringify(event,null,2));

  // Get the redirectUrl that matches this event's origin
  return await getRedirectURL(event.headers.origin)
  .then(async (redirectUrl) => {
    // conjure up an Oauth2Client
    await instantiateOauth2Client(redirectUrl);
  })  // End getRedirectURL.then
  .then(async () => {
    let authUrl = oauth2Client.generateAuthUrl({
      // 'online' is default, but 'offline' gets a refresh_token
      access_type: 'offline',
      // userinfo.email scope is to retrieve email address of user attempting to sign in
      scope: 'https://www.googleapis.com/auth/userinfo.email'
    });
    return await createResponseObject('200', authUrl);
  })  // End getRedirectURL.then.then
  .catch(async (err) => {
    console.error('generateauthurl handler:error: ',err.message);
    return await createResponseObject('400', err.message);
//    throw new Error(`[400] Shozbotz`);
  }); // End getRedirectURL.catch

}; // End generateauthurl handler

// generatetoken
// generate Oauth Token
module.exports.generatetoken = async (event, context) => {
  console.info('Received event:generateauthurl handler: ', JSON.stringify(event,null,2));

  // Get the redirectUrl that matches this event's origin
  return await getRedirectURL(event.origin)
  .then(async (redirectUrl) => {
    // conjure up an Oauth2Client
    await instantiateOauth2Client(redirectUrl);
    // Check if 'code' was provided with the event
    await validateRequiredVar(event.code)
    .then(() => {
      console.debug('generatetoken handler: code provided.');
    });
  })  // End getRedirectURL.then
  .then(async () => {
    // Swap google code for google token
    tokens = await oauth2Client.getToken(event.code)
    .then(async () => {
      console.debug('generatetoken handler: tokens:'+JSON.stringify(tokens,null,2));
      // Now tokens contains an access_token and an optional refresh_token. Save them.
      await oauth2Client.setCredentials(tokens);
    })  // End oauth2Client.getToken.then
    .catch((err) => {
      console.error(err);
      throw err;
    }); // End oauth2Client.getToken.catch
  })  // End getRedirectURL.then.then
  .then(async () => {
    // Get email addresses of the user attempting to login.
    return await oauth2.userinfo.get({ auth: oauth2Client });
  })  // End getRedirectURL.then.then.then
  .then(async (response) => {
    console.debut('oauth2.userinfo.get response:',JSON.stringify(response,null,2));
    // Check if the email address returned matches process.env.RESTRICTTODOMAIN
    await accountInDomain({
      account: response.data.email,
      domain: process.env.RESTRICTTODOMAIN
    })
    .then(() => {
      // The account used for login belongs to the specified domain, return the tokens
      tokens.admitted=1;
      tokens.email=response.data.email;
      console.debug(`Login admitted: ${response.data.email}`);
      return tokens;
    })  // End accountInDomain.then
    .catch((err) => {
      throw err;
    }); // End accountInDomain.catch
  })  // End getRedirectURL.then.then.then.then
  .then(async (tokens) => {
    console.debug('Tokens returns: ',JSON.stringify(tokens,null,2));
    return await createResponseObject('200', tokens);
  })  // End getRedirectURL.then.then .then.then.then oh man
  .catch(async (err) => {
    console.error('generatetoken handler: error: ',err);
    return await createResponseObject('400', err.toString());

  }); // End getRedirectURL.catch
};
