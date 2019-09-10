'use strict';

const {google} = require('googleapis');

exports.handler = (event, context, callback) => {
  console.log('Received event:', JSON.stringify(event,null,2)); //DEBUG
  // Check if required fields were populated
  if(!event.refreshToken || !event.accessToken) {
    callback("Required field missing", null);
  } else {
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
        var oauth2Client = new google.auth.OAuth2(
          process.env.clientId, // Client ID
          process.env.clientSecret, // Client Secret
          redirectUrl // Redirect URL decided above
        );

        // Set access and refresh tokens in credentials
        // Optionally, remove access_token to force refresh
        oauth2Client.setCredentials({
//          access_token: event.accessToken,    // access_token removed to force refresh
          refresh_token: event.refreshToken
        });

        // Request refreshed tokens from Google
        oauth2Client.getAccessToken(function(err, tokens, res) {
          if(err) {
            console.log("getAccessToken error: "+err);
            callback("getAccessToken error", null);
          } else {
            console.log("tokens: "+JSON.stringify(tokens,null,2));  //DEBUG
            if(res && res.data) {
              //console.log("results: ", util.inspect(res));  // DEBUG:
              if(res.data.hasOwnProperty('id_token')) {  // We return all of res.data, but it's id_token that we're really after
                console.log("res.data: "+JSON.stringify(res.data,null,2));  // DEBUG:
                callback(null, res.data);
              }
            } else {  // Only token returned, no res
              console.log("No refresh");// DEBUG:
              callback("No refresh",null);
            } // if(res)
          } // if(err)
        }); // oauth2Client.getAccessToken()

      } else {  // if(redirectUrl)
        console.error("Origin: "+event.origin+" is not permitted.");
        callback("Invalid Origin", null); // Login only allowed from approved origins
      }
    } else {  // if(required environment variables)
      console.error("Missing required environment variable(s)");
      callback("Internal error",null);
    }
  } // if(required fields)

} // End exports.handler
