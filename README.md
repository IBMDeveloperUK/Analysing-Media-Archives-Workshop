# Analysing Media Archives with Artificial Intelligence
_A workshop for IBM Code London_

## Overview

By following this workshop, you will learn the following:

1. How to analyse media files with Watson Visual Recognition
2. How to transcribe media files with Watson Speech To Text
3. How to set up a Cloudant DB instance
4. How to launch a Node.js Cloud Foundry app
5. How to build a simple search engine to expose insights gained from image classification and speech transcription

You will need:

1. An IBM Cloud Account - [Register here](https://console.bluemix.net/registration/)
2. The Cloud Foundry CLI tool - [Download here](https://github.com/cloudfoundry/cli/releases)
3. Node.js (if you wish to run the app locally) - [Download here](https://nodejs.org/)

## Setup

First we'll create the services that we'll need to support our application.

We'll set up the following services in the following order (the order doesn't really matter, but it's easier to follow this way).

1. Watson Visual Recognition
2. Watson Speech To Text
3. CloudantDB
4. Node.js Cloud Foundry App

_**Before proceeding any further, please log in to your IBM Cloud account, it'll make set up go a lot faster**_.

### Watson Visual Recognition
#### Creating an instance

1. Create a Visual Recognition instance by first clicking [here](https://console.bluemix.net/catalog/services/visual-recognition).
2. In the "Service Name" input, give your instance a unique and memorable name.
3. Scroll down and check that the pricing plan you've selected is 'Lite'.
4. Click 'Create'.

### Watson Speech to Text
#### Creating an instance

1. Create a Speech to Text instance by first clicking [here](https://console.bluemix.net/catalog/services/speech-to-text)
2. In the "Service Name" input, give your instance a unique and memorable name.
3. Scroll down and check that the pricing plan you've selected is 'Lite'.
4. Click 'Create'.

### CloudantDB
#### Creating an instance

1. Create a Speech to Text instance by first clicking [here](https://console.bluemix.net/catalog/services/cloudant)
2. In the "Service Name" input, give your instance a unique and memorable name.
3. In the "Available authentication methods" dropdown, select "Use both legacy credentials and IAM"
4. Scroll down and check that the pricing plan you've selected is 'Lite'.
5. Click 'Create'.
6. You'll be taken to your Cloudant DB instance page. 

#### Creating our tables

For our application we require 3 tables - 'index', 'frames', and 'transcripts'. Follow and repeat the next set of instructions to create the needed databases.

1. At the top right of your Cloudant DB dashboard, click 'Create Database'.
2. Enter the name of your database into the dropdown that appears (either index, frames, or transcripts) and click 'Create'
3. The database will be created, and you'll be taken to view it's documents (there aren't any yet). At the top left of your window, there will be a back arrow next to your database name. Click it.
4. You will now be back at your dashboard home page. Repeat steps 1 - 4 until you have created all 3 databases.

#### Creating an secondary index

In order for us to search for image classifications efficiently, we're going to create a secondary index.

1. Head back to the home page of your Cloudant DB instance (where you created your databases) and then click on the 'frames' database.
2. A new view will load. In the tool bar on the left hand side of the screen an option 'query' will appear, click it./
3. The sidebar will load an area where we can test Cloudant DB queries. To the bottom right of the text input there is a link 'manage indexes'. Click that.
4. The area to test Cloudant DB queries will now be replaced with an 'Index' creation field. Delete all of the text in the white box and paste the following in its place.

```json
{
    "index": {
        "fields": [
            "_id",
            "analysis.[].class"
        ]
    },
    "type": "json"
}
```

5. A new index should appear in the right-hand side of the page with the title `"json: _id, analysis.[].class"`. We're done here!

### Node.js Cloud Foundry App

We want to run our app on the cloud, so we'll create a Node.js Cloud Foundry instance to host and run our application.

#### Creating an instance

1. Create a Node.js Cloud Foundry instance by clicking [https://console.bluemix.net/catalog/starters/sdk-for-nodejs](here)
2. Under app name enter something unique and memorable. The app name will be used to make up your URL, so make sure to take note of it!
3. Under 'Pricing plans' make sure that you have the 'Lite' plan selected and that you have the **256**MB option selected. The app will not run well with less memory than that.
4. Click the 'Create' button.

## Building our Application

We now have all of the services that we need to run our analysis application. So, it's time to build it!

### Grabbing the source code and dependencies
1. Download or `git clone` this repo using the 'Clone or download' button at the top of this page.
2. Once you've recieved the source code, open up a terminal and head into the root of the project directory with `cd <PLACE YOU DOWNLOADED THE FILE TO>/analysing-media-archives-workshop`. In this directory, we have a basic Express.js server that we can use to deliver our web user interface, and that will grab assets for analysis by Watson. 
3. If you intend to run and test this code locally, once in the directory run `npm install`, but if you only want to try the code out on the Cloud, you can skip this step.

### 