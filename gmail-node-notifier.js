var readline = require('readline');
var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

var google = require('googleapis/lib/googleapis.js');
var OAuth2Client = google.auth.OAuth2;
var gmail = google.gmail('v1');
var REDIRECT_URL = 'urn:ietf:wg:oauth:2.0:oob';
var CLIENT_ID = process.env.CLIENT_ID;
var CLIENT_SECRET = process.env.CLIENT_SECRET;
var oauth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);

var Notification = require('node-notifier');
var notifier = new Notification();

var Datastore = require('nedb');
var db = new Datastore({ filename: '.database', autoload: true });
db.find({ tokens : { $exists: true } }, function(err, docs) {
  if (!err) {
    if (docs.length > 0) {
      oauth2Client.setCredentials(docs[0].tokens);
      check_for_messages();
    }
    else {
      getAccessToken(oauth2Client, check_for_messages);
    }
  }
});

function getAccessToken(oauth2Client, callback) {
  // generate consent page url
  var url = oauth2Client.generateAuthUrl({
    access_type: 'offline', // will return a refresh token
    scope: 'https://www.googleapis.com/auth/gmail.readonly' // can be a space-delimited string or an array of scopes
  });

  console.log('Visit the url: ', url);
  rl.question('Enter the code here:', function(code) {
    // request access token
    oauth2Client.getToken(code, function(err, tokens) {
      // set tokens to the client and store them in database
      oauth2Client.setCredentials(tokens);
      db.insert({ tokens : tokens});
      callback();
    });
  });
}

function check_for_messages() {
   gmail.users.messages.list({ userId: 'me', auth: oauth2Client, labelsIds: 'INBOX', q: 'is:unread' }, function(err, unread_messages) {
      if (!err) {
        console.log(unread_messages);
        //TODO: go through the list of unread messages, find the newest message, compare its date with the one in the database
        //if the date is newer, notify user and store date of message in database
        //else do nothing
        //var message_list = unread_messages.messages;
        //check_dates(message_list, function(newest_date) {
          //compare to database
        //});
        
        var highest_unread_msg_id = unread_messages.messages[0].id;
        db.find({ highest_msg_id: { $exists : true} }, function(err, docs) {
          if (!err) {
            var notify = false;
            if (docs.length > 0) {
              if (highest_unread_msg_id > docs[0].highest_msg_id) {
                notify = true;
                db.update( { highest_msg_id: { $exists : true } }, { highest_msg_id : highest_unread_msg_id });
              }
            }
            else {
              db.insert({ highest_msg_id : highest_unread_msg_id });
              notify = true;
            }
            if (notify) {
              notifier.notify({
                title: 'New message received',
                message: 'You have ' + unread_messages.resultSizeEstimate + ' new message(s)'
              }, function(error, response) {
                process.exit();
              });
            }
          }
        });
        //gmail.users.messages.get({ id: newest_msg_id, userId: 'me', auth: oauth2Client, format: 'metadata' }, get_date);
      }
  });
}

function get_date(err, msg) {
  var date = msg.payload.headers[2].value;
  console.log(date);
}

// function check_dates(message_list) {
//   var newest_date = 0;
//   for (var i = 0; i < message_list.length; i++) {
//     gmail.users.messages.get({ id: message_list[i].id, userId: 'me', auth: oauth2Client, format: 'metadata' }, get_date);
//   }
//   notifier.notify({
//     title: 'New message received',
//     message: 'You have ' + unread_messages.resultSizeEstimate + ' new message(s)'
//   }, function(error, response) {
//     //process.exit();
//   });
// }