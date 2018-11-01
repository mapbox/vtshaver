# How to debug with VS Code

VS Code is a great tool to develop many language. This document is to tell you how to debug C++ addon with the VS Code.

### 1. Setting up VSCode debug

To Set up the VSCode debug you have two ways to achive:

Option 1: Press Cmd + Shift + P to open the command bar, and type open `open launch.json`, choose `C++`.

Option 2: Click the debug button one the right side bar, and Click the ⚙ button one the right top, choose `C++`

![howtodebug](./image/howtodebug1.png)

In the `launch.json` you can see some templete, like this:

```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "(lldb) Launch",
            "type": "cppdbg",
            "request": "launch",
            "program": "enter program name, for example ${workspaceFolder}/a.out",
            "args": [],
            "stopAtEntry": false,
            "cwd": "${workspaceFolder}",
            "environment": [],
            "externalConsole": true,
            "MIMode": "lldb"
        }
    ]
}
```

`launch.json` is define which program you want to run after you click the debug, let's say `node node test/vtshaver.test.js`. In this command we want to use `node` to run `test/vtshaver.test.js`, so we need to chagne the configurations, put `program` to node's absolute path(you can use `which node` to find the path of node), and change the `args` to `test/vtshaver.test.js`'s absolute path. 

Additional we want everytime we run debug VS Code can rebuild the C++, so we add this line into the config:

```
"preLaunchTask": "npm: build:dev",
```

so the result could be 


```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "(lldb) Launch",
            "type": "cppdbg",
            "request": "launch",
            "preLaunchTask": "npm: build:dev",
            "program": "/Users/mapbox-mofei/.nvm/versions/node/v8.11.3/bin/node",
            "args": ["/Users/mapbox-mofei/dev/mapbox/vtshaver/test/vtshaver.test.js"],
            "stopAtEntry": false,
            "cwd": "${workspaceFolder}",
            "environment": [],
            "externalConsole": true,
            "MIMode": "lldb"
        }
    ]
}
```

Now go to any c++ files and click the left side of the line number to add an breakpoint, the go to the debug button on the side bar, click the run button on the top. 

![howtodebug](./image/howtodebug2.png)

Now everything is done! Debug is Done!