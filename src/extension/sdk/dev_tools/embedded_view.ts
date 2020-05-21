import * as vs from "vscode";
import { Event, EventEmitter } from "../../../shared/events";
import { DartDebugSessionInformation } from "../../utils/vscode/debug";

const devToolsPageNames: { [key: string]: string } = {
	inspector: "Flutter Widget Inspector",
	memory: "Flutter Memory View",
	performance: "Flutter Performance View",
	timeline: "Flutter Timeline",
};

const pageScript = `
window.addEventListener('message', (event) => {
	const message = event.data;
	const devToolsFrame = document.getElementById('devToolsFrame');
	switch (message.command) {
		case "setUrl":
			if (devToolsFrame.src !== message.url)
				devToolsFrame.src = message.url;
			break;
	}
});
`;

const scriptNonce = Buffer.from(pageScript).toString("base64");
const frameCss = "position: absolute; top: 0; left: 0; width: 100%; height: 100%";
const cssNonce = Buffer.from(frameCss).toString("base64");

export class DevToolsEmbeddedView {
	private readonly panel: vs.WebviewPanel;
	private onDisposeEmitter: EventEmitter<void> = new EventEmitter<void>();
	public readonly onDispose: Event<void> = this.onDisposeEmitter.event;

	constructor(public session: DartDebugSessionInformation, readonly devToolsUri: vs.Uri, readonly page: string) {
		const pageName = devToolsPageNames[page] || "Dart DevTools";
		this.panel = vs.window.createWebviewPanel("dartDevTools", pageName, vs.ViewColumn.Nine, {
			enableScripts: true,
			localResourceRoots: [],
			retainContextWhenHidden: true,
		});
		this.panel.onDidDispose(() => this.dispose(true));

		this.panel.webview.html = `
			<html>
			<head>
			<meta http-equiv="Content-Security-Policy" content="default-src 'self' 'nonce-${scriptNonce}' 'nonce-${cssNonce}' http://${devToolsUri.authority};">
			<script nonce="${scriptNonce}">${pageScript}</script>
			<style nonce="${cssNonce}">#devToolsFrame { ${frameCss} }</style>
			</head>
			<body><iframe id="devToolsFrame" src="about:blank" frameborder="0"></frame></body>
			</html>
			`;
	}

	public load(session: DartDebugSessionInformation, uri: vs.Uri): void {
		this.session = session;
		this.panel.webview.postMessage({ command: "setUrl", url: uri.toString() });
		this.panel.reveal();
	}

	private dispose(panelDisposed = false): void {
		if (!panelDisposed)
			this.panel.dispose();
		this.onDisposeEmitter.fire();
	}
}