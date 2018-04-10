const os = require('os');
const Path = require('path');
const fs = require('fs');
const promisify = require('es6-promisify');
const crypto = require('crypto');
const _exec = require('child_process').exec;
const request = require('request');

let exec = function (command) {
    return new Promise((resolve, reject) => {
        _exec(command, (err, stdout, stderr) => {
            if (err) {
                return reject(err + ' - ' + stderr);
            }

            return resolve(stdout || stderr);
        });
    });
};

/**
 * Parse and verify a manifest
 * @param vendorId The vendor ID as GUID string
 * @param deviceClassId The device class ID as GUID string
 * @param certificateBuffer Buffer that contains the private key of the certificate (.der file)
 * @param manifestBuffer Buffer that contains the actual manifest
 * @returns Promise that holds the parsed manifest
 */
let parseAndVerifyManifest = async function (vendorId, deviceClassId, certificateBuffer, manifestBuffer) {
    let tmpFolder = Path.join(os.tmpdir(), (await promisify(crypto.randomBytes.bind(crypto))(32)).toString('hex'));

    let maniFile = Path.join(tmpFolder, 'm.manifest');
    let certFile = Path.join(tmpFolder, 'm.der');

    try {
        // create temp folder
        await promisify(fs.mkdir.bind(fs))(tmpFolder);

        // then put the manifest in there...
        await promisify(fs.writeFile.bind(fs))(maniFile, manifestBuffer);
        // then put the certificate in there
        await promisify(fs.writeFile.bind(fs))(certFile, certificateBuffer);

        // get the fingerprint of the cert
        let t = await exec('openssl x509 -inform der -in "' + certFile + '" -sha256 -fingerprint -noout');
        let fingerprint = t.replace('SHA256 Fingerprint=', '').split(':').join('').trim().toLowerCase();

        // and rename the cert file to the fingerprint... (weird manifest-tool thingy)
        promisify(fs.rename.bind(fs))(certFile, Path.join(tmpFolder, fingerprint));

        // now we can verify the manifest
        let verify = await exec(`manifest-tool verify -i "${maniFile}" -V ${vendorId} -C ${deviceClassId} -c ${tmpFolder}`);

        // and parse the manifest
        let manifest = JSON.parse(await exec(`manifest-tool parse -ji "${maniFile}"`));

        return manifest.resource.resource.manifest;
    }
    catch (ex) {
        throw ex;
    }
    finally {
        for (let file of await promisify(fs.readdir.bind(fs))(tmpFolder)) {
            await promisify(fs.unlink.bind(fs))(Path.join(tmpFolder, file));
        }

        await promisify(fs.rmdir.bind(fs))(tmpFolder);
    }
};

function request_get(path) {
    return new Promise((resolve, reject) => {
        request.get({
            url: path,
            encoding: null
        }, function (err, res, body) {
            if (err) return reject(err);
            if (res.statusCode < 200 || res.statusCode > 300) {
                return reject('Status code should be 2xx, but was ' + res.statusCode);
            }
            return resolve(body);
        });
    });
}

let downloadAndVerifyFirmware = async function (manifest) {
    let firmware;
    try {
        firmware = await request_get(manifest.payload.reference.uri);
    }
    catch (ex) {
        throw 'Downloading firmware failed - ' + ex;
    }

    if (firmware.length !== manifest.payload.reference.size) {
        throw `Length mismatch - Expected ${manifest.payload.reference.size}, but got ${firmware.length}`;
    }

    let hash = crypto.createHash('sha256').update(firmware).digest('hex').toLowerCase();

    if (hash !== manifest.payload.reference.hash) {
        throw `Hash mismatch - Expected ${manifest.payload.reference.hash}, but got ${hash}`;
    }

    return firmware;
};

module.exports = {
    parseAndVerifyManifest: parseAndVerifyManifest,
    downloadAndVerifyFirmware: downloadAndVerifyFirmware
};
