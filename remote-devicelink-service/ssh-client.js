const ssh2 = require('ssh2');

function spawn_ssh_client(host, username, privateKey, binary, port, id) {
    let started = false;
    let stdout = '';
    let stderr = '';

    return new Promise((resolve, reject) => {

        let conn = new ssh2.Client();
        conn.on('ready', function () {
            conn.shell(function (err, stream) {
                if (err) throw err;
                stream.on('close', function () {
                    // console.log('Stream :: close', stdout, stderr);

                    if (!started) {
                        reject('Client failed to start: ' + stdout + ' ' + stderr);
                    }

                    conn.end();
                }).on('data', function (data) {
                    stdout += data.toString('utf-8');

                    if (!started && stdout.indexOf('mbed Cloud Devicelink Server starting') > -1) {
                        started = true;
                        resolve({
                            close: function() {
                                return new Promise((resolve, reject) => {
                                    stream.once('close', resolve);
                                    stream.close();
                                });
                            },
                            port: port
                        });
                    }

                    // console.log('[SSH]', data.toString('utf-8'));

                }).stderr.on('data', function (data) {
                    stderr += data.toString('utf-8');
                });
                stream.end(`${binary} ${id} ${port}\nexit\n`);
            });
        }).on('error', reject).connect({
            host: host,
            port: 22,
            username: username,
            privateKey: privateKey
        });
    });
}

module.exports = {
    spawn: spawn_ssh_client
};
