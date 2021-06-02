## How to install botmaker-cli

#### Steps
- Run `npm i -g @botmaker.org/botmaker-cli` on bash command-line.

#### Problems on windows?  
- Failed `node-gyp` rebuild and/or `python 2.7` issue  
    - Try running `npm install --global windows-build-tools` on Windows Powershell as Administrator  
    - Create `PYTHON` environment variable and set `C:\Users\YOUR_USER\.windows-build-tools\python27\python.exe` directory  
    - Run `bmc` on bash command-line
    