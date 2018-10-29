# Pinegrow + VSCode

This Visual Studio Code plugin enables live editing with Pinegrow Web Editor. Changes done in Pinegrow are synced to VS Code and vice versa.

[Pinegrow](https://pinegrow.com) is a powerful web editor that lets you visually build Bootstrap, Foundation, WordPress and plain HTML websites.

**Pinegrow 2.9 or newer is required.**

[Go here](https://pinegrow.com/docs/master-pinegrow/using-external-code-editors/visual-studio-code/) for more details about how to use the plugin.

## Live editing in concert

All edits are live-synced between VS Code and Pinegrow, without having to save changes first.

## Navigate the code visually

Elements selected in Pinegrow are highlighted in VS Code.

## Control Pinegrow from VS Code

Use the context menu or keyboard shortcuts to:

* **Select an element** in Pinegrow with Cmd+Alt+P on Mac, Ctrl+Alt+P on Win / Linux
* **Open the page** in Pinegrow with Cmd+Alt+O on Mac, Ctrl+Alt+O on Win / Linux
* **Refresh the page** in Pinegrow with Cmd+Alt+R on Mac, Ctrl+Alt+R on Win / Linux

## Edit HTML and CSS files

Live sync works for HTML (or other types that are listed among editable types in Pinegrow's settings) and CSS/SASS/LESS files.

## How to install

In VS Code, go to Code -> Preferences -> Extensions or click on the Extensions icon in the Activity bar.

There, use the search box to search for "Pinegrow Live Sync".

Click on Install and reload VS Code if necessary.

That's all you need to do - if you are using default settings for Pinegrow's internal web server.

### Configuring the plugin

If you are using custom port setting in Pinegrow you have to configure the Pinegrow VS Code plugin accordingly.

First, in Pinegrow, go to Support -> Show API Url. Copy the value that is displayed.

In VS Code go to Settings -> Extensions and use the search box to find Pinegrow settings. Paste the API url value in there.