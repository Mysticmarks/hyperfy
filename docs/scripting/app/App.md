# App

The global `app` variable is always available within the app scripting runtime.

## Properties

### `.instanceId`: String

The instance ID of the current app.
Every app has its own unique ID that is shared across all clients and the server.

### `.version`: String

The version of the app instance.
This number is incremented whenever the app is modified which includes but is not limited to updating scripts and models.

### `.state`: Object

A plain old javascript object that you can use to store state in.
The servers state object is sent to all new clients that connect in their initial snapshot, allowing clients to initialize correctly, eg in the right position/mode.

### `.{...Node}`

Inherits all [Node](/docs/scripting/nodes/Node.md) properties

## Methods

### `.on(name, callback)`

Subscribes to custom networked app events and engine update events like `update`, `fixedUpdate` and `lateUpdate`.

Custom networked events are received when a different client/server sends an event with `app.send(event, data)`. 

IMPORTANT: Only subscribe to update events when they are needed. The engine is optimized to completely skip over large amounts of apps that don't need to receive update events.

### `.off(name, callback)`

Unsubscribes from custom events and update events.

IMPORTANT: Be sure to unsubscribe from update events when they are not needed. The engine is optimized to completely skip over large amounts of apps that don't need to receive update events.

### `.send(name, data, skipNetworkId)`

Sends an event across the network.
If the caller is on the client, the event is sent to the server. The third argument `skipNetworkId` is a no-op here.
If the caller is on the server, the event is sent to all clients, with the `skipNetworkId` argument allowing you to skip sending to one specific client.

### `.emit(name, data)`

Emits a local event to the world that other apps can listen for (using `world.on(name, callback)`).
Emitted events are not networked and only "local" apps (on the same client or server) can receive/listen for them.

NOTE: you cannot emit built-in events such as `enter` or `leave` as these are internal and emitted when players enter or leave the world.

### `.get(nodeId)`: Node

Finds and returns any node with the matching ID from the model the app is using.
If your model is made with blender, this is the object "name".

NOTE: Blender GLTF exporter renames objects in some cases, eg by removing spaces. Best practice is to simply name everything in UpperCamelCase with no other characters.

### `.create(nodeName)`: Node

Creates and returns a node of the specified name.

#### `.control(options)`: Control

Requests a high-priority input binding for the app. The optional `options` object is passed through to the control system, so
you can specify an `onRelease` callback to clean up when the binding is lost. Apps always receive `ControlPriorities.APP`, so
their inputs trump the local player while the control is active. 【F:src/core/systems/Apps.js†L307-L324】【F:src/core/systems/ClientControls.js†L246-L303】

The returned handle lazily exposes input channels. Asking for `control.keyW` or `control.mouseLeft` creates button trackers with
`down`, `pressed`, and `released` flags plus `onPress`/`onRelease` hooks; setting `capture = true` on a button or vector stops
lower-priority bindings from seeing the event. Pointer and XR helpers expose the latest `position`, `coords`, and `delta`, and
they include `lock()`/`unlock()` helpers that forward to the browser pointer-lock API (remember to call these from a user
gesture). Screen metadata and scroll values are also available so UI can respond to viewport changes. 【F:src/core/systems/ClientControls.js†L266-L392】【F:src/core/systems/ClientControls.js†L640-L725】

For camera-driven experiences you can read and write through `control.camera`: enable `camera.write = true` to drive the rig,
update its `position`, `quaternion`, or `zoom`, and use the bound Euler `rotation` helper for yaw/pitch style controls. When the
control should go away, call `control.release()` or rely on `destroy` handlers—apps automatically release any bound controls
before rebuilding or shutting down. 【F:src/core/systems/ClientControls.js†L214-L235】【F:src/core/entities/App.js†L144-L216】

#### `.configure(fields)`

Configures custom UI for your app. See [Props](/docs/scripting/app/Props.md) for more info.

