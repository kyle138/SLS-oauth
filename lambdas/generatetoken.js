'use strict';

const {google} = require('googleapis');
const oauth2 = google.oauth2('v2');

exports.handler = (event, context, callback) => {
  console.log('Received event:', JSON.stringify(event,null,2)); //DEBUG
  if(!event.code) {
    callback("Required field missing: code");
  }
  var code = event.code;

  // Check if required Lambda environment variables are set
  if( process.env.clientId &&
      process.env.clientSecret &&
      process.env.redirectUrl1 &&
      process.env.redirectUrl2)
  {
    // Check if origin is included as one of the redirectUrls
    var redirectUrl = (process.env.redirectUrl1.indexOf(event.origin) != -1)
      ? process.env.redirectUrl1
      : (process.env.redirectUrl2.indexOf(event.origin) != -1)
        ? process.env.redirectUrl2
        : null;

    if(redirectUrl) {
      // Initialize oauth2Client
      const oauth2Client = new google.auth.OAuth2(
        process.env.clientId, // Client ID
        process.env.clientSecret, // Client Secret
        redirectUrl // Redirect URL decided above
      );

      // Swap google code for google token
      oauth2Client.getToken(code, function(err, tokens) {
        if (err) {
          console.log("Error getToken: "+err);
          callback(err, null);
        } else {
          console.log("Success getToken!"); //DEBUG
          // Now token contains an access_token and an optional refresh_token. Save them.
          oauth2Client.setCredentials(tokens);
          // Get email addresses of user attempting to login.
          oauth2.userinfo.get({ auth: oauth2Client }, function(err, response) {
            if(err) {
              console.log("Error oauth2.userinfo.get: "+err);
              callback(err,null);
            } else {
              // In this case we only want to return tokens for users logged in with @hartenergy.com google accounts
              accountInDomain(response.data.email, '@hartenergy.com', function(err, res) {
                if(err) {
                  console.log("Error accountInDomain: "+err);
                  callback(err,null);
                } else {
                  if(res) {
                    tokens.admitted=1;  //The logged in account is admitted
                    tokens.email=response.data.email;
                    console.log("Login admitted: "+response.data.email);
                    callback(null, tokens);
                  } else {
                    console.log("Non @hartenergy.com email address");
                    var ret = {
                      "admitted": 0,
                      "errorMessage": "Access denied. Please log out of your Google account in this browser and log back in using your @hartenergy.com account."
                    };
                    callback(null, ret);
                  } // END if(@hartenergy.com)
                }
              }); // End accountInDomain
            }
          }); // END oauth2.userinfo.get()
        } // Sweet callbackhell, aren't we done closing {}s yet?
      }); // END oauth2Client.getToken()
    } else {  // if(redirectUrl)
      console.error("Origin: "+event.origin+" is not permitted.");
      callback("Invalid Origin", null); // Login only allowed from approved origins
    }
  } else {  // if(required environment variables)
    console.error("Missing required environment variable(s)");
    callback("Internal error",null);
  }
};  // END exports.handler

// Check if account is within the specified domain
function accountInDomain(account, domain, cb) {
  if(!account || !domain) {
    if(typeof cb === 'function' && cb("Error: 'account' and 'domain' are required arguments", null));
    return false;
  } else {
    if(account.indexOf(domain) > -1) {
      if(typeof cb === 'function' && cb(null, true));
      return true;
    } else {
      if(typeof cb === 'function' && cb(null, false));
      return false;
    }
  } // End if !account || !domain
}; // End accountInDomain()
