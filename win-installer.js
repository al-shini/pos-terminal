const electronInstaller = require('electron-winstaller');

const build = async () => {
    try {
        await electronInstaller.createWindowsInstaller({
            appDirectory: './out/plus-pos-win32-x64',
            outputDirectory: './out/dazzle64',
            authors: 'Legion',
            exe: 'plus-pos.exe'
        });
        console.log('It worked!');
    } catch (e) {
        console.log(`No dice: ${e.message}`);
    }
}

build();