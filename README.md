# SLS-oauth
Serverless backend for googleapi's oauth2 generateAuthUrl, generateToken, and refreshToken.  
This can be used in combination with AWS Cognito to secure API Gateway endpoints for a single page app.
For more detail visit [here](https://kyle138.github.io/oauthlambdacognito/)  
v2.0.1  

## Note:
  After cloning or pulling changes remember to run 'npm install' from the **/layers/CommonModules/nodejs** directory.  

## Configuration:  
In the /resources directory, copy dev1-envs.yml.sample to dev1-envs.yml  
This file contains the environment variables for all three of the Lambda functions.  
* CLIENTID - **(Required)** The clientid string provided by Google Developer Console.  
* CLIENTSECRET - **(Required)** The clientsecret string provided by Google Developer Console.  
* REDIRECTURLS - **(Required)** A space separated list of the redirect urls you specified in the Google Developer Console.  
* RESTRICTTODOMAINS - (Optional) A space separated list of email domains you want to restrict logins from. Remove this line to allow logins from all domains. Each entry must begin with @ sign.  
* RESTRICTTOIPS - (Optional) A space separated list of IP addresses that you want to restrict logins from. Remove this line to allow logins from all IPs. Must be a full IPV4 or IPV6 address, IP ranges and CIDR notation not supported.  

*Repeat these steps for each stage before running serverless deploy.*

## Components:  
- **Layers:** ```CommonModules``` Lambda layer with the following NPM modules:
  - googleapis  
  - create-response-object  
- **API Gateway Endpoints and associated Lambdas:**  
  - ```/generateauthurl``` (GET) - Lambda handler that queries the Google API to generate an authorization URL to send the end user to for login.  
  - ```/generatetoken``` (POST) - After the user selects an account to authorize a code is returned. This Lambda handler exchanges that code for a token from the Google API.  
  - ```/refreshtoken``` (POST) - Oauth2 tokens are only valid for 1 hour. This Lambda handler accepts the accessToken and refreshToken previously provided by **generatetoken** and queries the Google API for a refresh token.  

## Credits:  
At the time of this project I couldn't find a single walkthrough for using Cognito with a webapp, only for iOS or Android. I found several how-tos describing parts of the answer and have pieced them together to create this document. I have included those sources below.
- [Google API oauth flow with node.js](https://youtu.be/bFpMTdy0ogU) - YouTube video created by Michal Stefanow. Before implementing the Cognito Identity Pool you have to first understand Google+ oauth flow itself. This was the best walkthrough I found for implementing it in a single-page webapp using Node.js and Angular.  
- [Amazon API Gateway Tutorial by Auth0](https://auth0.com/docs/integrations/aws-api-gateway) - A modification of the standard Pet Store app using IAM to secure the API Gateway. This walkthrough focuses on using Auth0's own service rather than Cognito but reveals the process of securing and accessing API Gateway using temporary credentials. To be honest, in a public-facing production environment I would recommend using Auth0 as they support multiple identity providers which they maintain preventing you from constantly updating your code. You will need to create an Auth0 account to complete their tutorial but they give you a 30 day free trial.  
