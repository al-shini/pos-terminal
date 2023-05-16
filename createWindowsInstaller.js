const electronInstaller = require('electron-winstaller');

const build = async () => {
    try {
        await electronInstaller.createWindowsInstaller({
            appDirectory: './out/pos-win32-x64',
            outputDirectory: './installer',
            authors: 'Legion',
            exe: 'pos.exe'
        });
        console.log('It worked!');
    } catch (e) {
        console.log(`No dice: ${e.message}`);
    }
}

build();