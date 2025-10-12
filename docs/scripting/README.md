# Scripts

## IMPORTANT

As Hyperfy is in alpha, the scripting API is likely to evolve fast with breaking changes.
This means your apps can and will break as you upgrade worlds.
Once scripting is stable we'll move toward a forward compatible model, which will allow apps to be shared/traded with more confidence that they will continue to run correctly.

## Lifecycle

Hyperfy worlds run the same simulation loop on both the authoritative server and on every connected client. Each tick of the
[`World`](../world/World.md) advances through fixed updates, variable updates, late updates, and commit phases, so scripts only
execute during the portions that they explicitly subscribe to. 【F:src/core/World.js†L21-L123】

When a world boots, the server loads the saved blueprints for every app and calls [`App.build`](../app/App.md). This fetches the
GLB, converts it into a node hierarchy, and then executes the app script if the instance is active. The same build pipeline
runs on each client as soon as the server streams the blueprint snapshot, so both environments see the same node graph and
scripted behaviour. 【F:src/core/entities/App.js†L21-L144】

Scripts live side-by-side on the server and client. Networking keeps them in sync: the server is the source of truth for
`app.state`, so new clients receive the latest state during their initial snapshot, and custom events relayed with
`app.send`/`app.emit` travel through the [Apps system](../app/App.md#send-name-data-skipnetworkid). 【F:docs/scripting/app/App.md†L25-L53】

Once a script is running, the app emits `fixedUpdate`, `update`, and `lateUpdate` callbacks during the corresponding world
phases on any side where the script is active. Subscribing with `app.on('update', ...)` marks the app as "hot", ensuring the
engine invokes it every frame; unsubscribing relinquishes those ticks to keep idle apps cheap. 【F:src/core/entities/App.js†L151-L190】

Whenever a blueprint changes (for example after publishing a new model or script) or an app is removed, the engine first fires
`destroy`, releases any grabbed controls, deactivates spawned world nodes, and clears event listeners. The app then rebuilds
from the new data or shuts down cleanly, so both server and clients converge on the same version. 【F:src/core/entities/App.js†L144-L216】

## Apps

[Apps](./app/App.md) power Hyperfy's content. You can think of them as a combination of a model and a script. They can talk to eachother, and run both on the client and the server. Apps have a UI to configure [properties](./app/Props.md) in the scripts, and can load additional models inside of them.

## Nodes

Apps are made up of a hierarchy of [nodes](./nodes/Node.md) that you can view and modify within the app runtime using scripts.

The gltf model that each app is based on is automatically converted into nodes and inserted into the app runtime for you to interact with.

Certain node [types](./nodes/types/) can also be created and used on the fly using `app.create(nodeName)`.

## World

The [World](./world/World.md) API access methods and properties outside of the Apps, like players, networking or managing nodes outside of the local hierarchy. 

## Utils 

The [Utils](./utils.md) documentation provides a set of miscellaneous globals available in the scripting environment, like a random number generator and access to some `three.js` methods.

## Networking

Hyperfy [Networking](./Networking.md) happens inside of Apps, using methods from both the `App` and `World` APIs. You can either send events between the client and server on the same app, or send messages to external apps on the server. 

## Globals

- [app](./app/App.md)
- [world](./world/World.md)
- [props](./app/Props.md)
- [utils](./utils.md)