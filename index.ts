import * as Web3 from 'web3';
import * as web3FusionExtend from "web3-fusion-extend";
import * as WebSocket from 'websocket';
import * as dotenv from 'dotenv';
import { spawn } from 'child_process';
import * as sleep from 'sleep';

dotenv.config();
const ws_server = 'ws://node.fusionnetwork.io/primus/?_primuscb=1546917854134-0';

var wb = new Web3();
var web3 = web3FusionExtend.extend(wb);
var client = new WebSocket.client();
var latestBlockNumber = 0;
var nodes = process.env.NODE_ID.split(',');
var nodeInfo = {};

nodes.forEach(node => {
  nodeInfo[node] = 0;
});

function resetNodeInfo(node) {
  nodeInfo[node] = 0;
}

client.on('connectFailed', function(error) {
    console.log('Connect Error: ' + error.toString());
    client.connect(ws_server, 'get_latest_block');
});

client.on('connect', function(connection) {
    console.log('WebSocket Client Connected');
    connection.on('error', function(error) {
        console.log("Connection Error: " + error.toString());
        client.connect(ws_server, 'get_latest_block');
    });
    connection.on('close', function() {
        console.log('Connection Closed');
        client.connect(ws_server, 'get_latest_block');
    });
    connection.on('message', function(message) {
       try {
          var data = JSON.parse(message.utf8Data);
          if (data.action !== 'block')
            return;

          var blockNumber = data.data.block.number;
          if (latestBlockNumber < blockNumber)
            latestBlockNumber = blockNumber;
          
          nodes.forEach(node => {
            if (data.data.id === node.trim() && nodeInfo[node] == 0) {
              if (latestBlockNumber - blockNumber >= parseInt(process.env.DIFF_COUNT)) {
                console.log('Restarting node <' + data.data.id + '>, because <node block = ' + blockNumber + '> is less than <current block = ' + latestBlockNumber + '>');
                const restartSh = spawn('sh', [ process.env.SCRIPT_FILE ], {
                  cwd: process.env.SCRIPT_PATH,
                  env: Object.assign({}, process.env, { PATH: process.env.PATH + ':/usr/local/bin' })
                });
                restartSh.stdout.on('data', (data) => {
                  console.log(data.toString());
                });
                nodeInfo[node] = 1;
                setTimeout(() => resetNodeInfo(node), parseInt(process.env.WAITING_TIME_SECOND) * 1000);
              }
            }
          })
        } catch (e) {
          console.log(e);
          return;
        }
    });
});
client.connect(ws_server, 'get_latest_block');

async function connectService() {
  let provider;

  try {
    provider = new web3.providers.WebsocketProvider("wss://gateway.fusionnetwork.io:10001", {
      timeout: 10000
    });
    web3.setProvider(provider);

    const block = await web3.eth.getBlock("latest");
    console.log(block.number);

  } catch (e) {
    console.log(
      "Provider has a problem trying again in 10 seconds or check connect argument"
    );
    setTimeout(connectService, 1000);
  }
};
