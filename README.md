conversation-scope
================

This is a [Node.js](https://nodejs.org/en/) module, which **extends** session with *conversation scope* - concept from JBoss.
It is session agnostic, so it can be integrated with any session module, no matter if it use database to store data or just memory.

[![npm version](https://badge.fury.io/js/conversation-scope.svg)](http://badge.fury.io/js/conversation-scope)

- [Concept](#concept)
- [Installation](#installation)
- [Example integration](#example-integration)
- [API](#api)
- [License](#license)

## Concept

The conversation scope is a bit like the traditional session scope in that it holds state associated with a user of the system, and spans multiple requests to the server. However, unlike the session scope, the conversation scope:

- is demarcated explicitly by the application, and
- holds state associated with a particular web browser tab in a web application (browsers tend to share domain cookies, and hence the session cookie, between tabs, so this is not the case for the session scope).

A conversation represents a task—a unit of work from the point of view of the user. The conversation context holds state associated with what the user is currently working on. If the user is doing multiple things at the same time, there are multiple conversations.

The conversation context is active during any request. Most conversations are destroyed at the end of the request. If a conversation should hold state across multiple requests, it must be explicitly promoted to a long-running conversation.


### More details

- There is always a conversation context active during the request lifecycle. At the start, module attempts to restore any previous long-running conversation context. If no cid was provided, *conversation-scope* creates a new temporary conversation context.
-  When an begin() method is encountered, the temporary conversation context is promoted to a long running conversation.
-  When an end() method is encountered, any long-running conversation context is demoted to a temporary conversation.
- At the end of the render response phase of request lifecycle, module stores the contents of a long running conversation context or destroys the contents of a temporary conversation context.
- By default, conversation context is not propagated, so every request will be processed in a new temporary conversation. If you want to propagate it, you need to explicitly code the conversation id as a request parameter:

    <a href="/page?cid=<% req.cs.cidValue %>">Continue session</a>

## Installation

You can download module source from [GitHub](https://github.com/koxu1996/conversation-scope) or install it with Node Package Manager (npm):

```sh
$ npm install conversation-scope
```

## Example integration

### Express + NodeSession

```js
...

app.use(function (req, res, next) {
    session.startSession(req, res, next);
})

app.use(function (req, res, next) {
    var config = {
        getCallback: function(key) {
            return req.session.get(key)
        },
        putCallback: function(key, value) {
            return req.session.put(key, value)
        }
    }
    ConversationScope.run(req, res, next, config)
})

...
```

See examples for reference.

## API

```js
var ConversationScope = require("conversation-scope")
```

### ConversationScope.run(req, res, next, options)

Run module as middleware with the given `options`. It generally loads conversation, adds `cs` property to request, then calls `next` function.

#### Options

`conversation-scope` accepts these properties in the options object.

###### getCallback (required)

Function in form of `fn(key)`, which will be used internally by module in order to get data.

###### putCallback (required)

Function in form of `fn(key, value)`, which will be used internally by module in order to save data.

###### excludedKeys

Specifies the keys which should be excluded from conversation scope and treated like normal data in session.

### req.cs.put(key, value)

Stores in conversation data specified with `key` and `value`.

### req.cs.get(key)

Retrieves data from session, which was stored with provided `key`.

### req.cs.cidValue()

Returns current conversation ID.

### req.cs.begin()

Specifies that a long-running conversation begins.

#### req.cs.begin({join: true})

Specifies that if a long-running conversation is already in progress, the conversation context is simply propagated.

#### req.cs.begin({nested: true})

Specifies that if a long-running conversation is already in progress, a new nested conversation context begins. The nested conversation will end when the next end() is encountered, and the outer conversation will resume.
It is perfectly legal for multiple nested conversations to exist concurrently in the same outer conversation.

### req.cs.end()

Specifies that a long-running conversation ends. Ending a nested conversation simply pops the conversation stack and resumes the outer conversation.

#### req.cs.end({root: true})

Specifies that the root conversation should be destroyed which effectively destroys the entire conversation stack. If the conversation is not nested, the current conversation is simply ended.

## License

[MIT](LICENSE)
