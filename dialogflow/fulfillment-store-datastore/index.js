const functions = require('firebase-functions');
const admin = require('firebase-admin');
const dialogflow = require('dialogflow');
process.env.DEBUG = 'dialogflow:*'; // enables lib debugging statements
admin.initializeApp(functions.config().firebase);
const db = admin.firestore();
const {WebhookClient} = require('dialogflow-fulfillment');

const projectId = "epam-pankajjo";

exports.dialogflowFirebaseFulfillment = functions.https.onRequest((req,res) =>{
  const answer = req.body.queryResult.queryText;
  
  const outputContexts = req.body.queryResult.outputContexts;
  const sizeContexts = outputContexts.length;
  const lastOutputContextName = outputContexts[sizeContexts - 1].name;
  const sessionIdStartAt = 25 + projectId.length;
  const sessionIdEndAt = lastOutputContextName.search("contexts");
  const sessionId = lastOutputContextName.substring(sessionIdStartAt, sessionIdEndAt - 1);

  var docRef = db.collection("User").doc(sessionId);
  docRef.get().then(function(doc) {
    try {
      if (doc.exists) {
        outputContexts.forEach(function(contexts){
  			const outputContextName = contexts.name;
            const sessStartAt = 25 + projectId.length;
            const sessEndAt = outputContextName.search("contexts");
            const sessId = outputContextName.substring(sessStartAt, sessEndAt - 1);
            const contextId = outputContextName.substring(sessEndAt + 9);
        	reActivateContext(contextId, sessId, projectId); 
        });
      } else {
        db.collection("User").doc(sessionId).set({outputContextName: lastOutputContextName});
        runSample(sessionId, projectId);
      }
    } catch (e) {
      console.log("Exception occurred...", e); 
    }
  });
  
  async function reActivateContext(context_id, session_id, project_id) {
    // Instantiates clients
    const contextsClient = new dialogflow.ContextsClient();

    const sessionPath = contextsClient.sessionPath(projectId, session_id);
    const contextPath = contextsClient.contextPath(
      project_id,
      session_id,
      context_id
    );

    const createContextRequest = {
      parent: sessionPath,
      context: {
        name: contextPath,
        lifespanCount: 5,
      },
    };

    const responses = await contextsClient.createContext(createContextRequest);
    console.log(`Created ${responses[0].name} context`);
    res.status(200).send({"create context response":responses[0]});
  }
  
  async function runSample(session_id, project_id) {

    // Create a new session
    const sessionClient = new dialogflow.SessionsClient();
    const sessionPath = sessionClient.sessionPath(project_id, session_id);

    // The text query request.
    const request = {
      session: sessionPath,
      queryInput: {
        text: {
          text: answer,
          languageCode: 'en-US',
        },
      },
      queryParams: {
    	contexts: outputContexts
      }
    };
    // Send request and log result
    const responses = await sessionClient.detectIntent(request);
    const result = responses[0].queryResult;
    const action = result.action;
    console.log(`  Query: ${result.queryText}`);
    console.log(`  Response: ${result.fulfillmentText}`);
    if (result.intent) {
      console.log(`  Intent: ${result.intent.displayName}`);
      res.status(200).send({"question":result.fulfillmentText,"action":action});
    } else {
      console.log(`  No intent matched.`);
      res.status(400).send({"action":"empty"});
    }
  }
});

