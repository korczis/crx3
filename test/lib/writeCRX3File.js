const fs = require('fs');
const path = require('path');
const exec = require('child_process').execSync;
const test = require('tape-catch');
const writeCRX3File = require('../../lib/writeCRX3File');

const CWD = process.cwd();

test('writeCRX3File', t => {
	t.strictEqual(typeof writeCRX3File, 'function', 'Should export a function');

	t.test('... without args', testWriteCRX3FileWithoutArgs);
	t.test('... without manifest.json', testWriteCRX3FileWithoutManifestJSON);
	t.test('... with both files and options', testWriteCRX3FileWithFilesAndOptions);

	t.end();
});

/* eslint-disable jsdoc/require-jsdoc */
function testWriteCRX3FileWithoutArgs (t) {
	const p = writeCRX3File();
	const crxPath = path.join(CWD, 'web-extension.crx');

	t.strictEqual(typeof p, 'object', 'Should return an object when called without arguments');
	t.strictEqual(p.constructor.name, 'Promise', 'Returned object should be a Promise');

	p
		.then(() => t.fail('Returned promise should not resolve'))
		.catch(() => t.pass('Returned promise should reject'))
		.finally(() => {
			try {
				fs.statSync(crxPath);
			}
			catch (err) {
				t.ok(err, `Should not create any "${crxPath}" file`);
			}
			t.end();
		});
}

function testWriteCRX3FileWithoutManifestJSON (t) {
	const p = writeCRX3File([__dirname]);
	const crxPath = path.join(CWD, 'web-extension.crx');

	t.strictEqual(typeof p, 'object', 'Should return an object when called with files');
	t.strictEqual(p.constructor.name, 'Promise', 'Returned object should be a Promise');

	p
		.then(() => t.fail('Returned promise should not resolve'))
		.catch(() => t.pass('Returned promise should reject'))
		.finally(() => {
			try {
				if (fs.statSync(crxPath).size > 0) {
					throw new Error(`"${crxPath} file is not empty`);
				}
				fs.unlinkSync(crxPath);
			}
			catch (err) {
				t.error(err, `Should create an empty "${crxPath}" file`);
			}
			t.end();
		});
}

function testWriteCRX3FileWithFilesAndOptions (t) {
	const name = `test${process.hrtime.bigint()}`;
	const temp = {
		crx: path.join(CWD, `${name}.crx`),
		zip: path.join(CWD, `${name}.zip`),
		xml: path.join(CWD, `${name}.xml`)
	};

	const manifestPath = path.join(CWD, 'example', 'example-extension', 'manifest.json');
	const utime = new Date('2019-03-24T23:29:00.000Z');
	try {
		fs.utimesSync(manifestPath, utime, utime);
		fs.utimesSync(path.dirname(manifestPath), utime, utime);
	}
	catch (err) {
		t.comment('Should be able to change atime and mtime of example paths, to create matchable files');
		t.fail(err);
		t.end();
		return;
	}

	const p = writeCRX3File([manifestPath], {
		crxPath: temp.crx,
		zipPath: temp.zip,
		xmlPath: temp.xml,
		keyPath: path.join(CWD, 'example', 'example-extension.pem')
	});

	t.strictEqual(typeof p, 'object', 'Should return object when called with files and options');
	t.strictEqual(p.constructor.name, 'Promise', 'Returned object should be a Promise');

	p
		.then(cfg => compareWithExample(t, cfg))
		.catch(err => t.end(err));
}

function compareWithExample (t, cfg) {
	const examplePath = path.join(CWD, 'example');
	const example = {
		crx: path.join(examplePath, 'example-extension.crx'),
		zip: path.join(examplePath, 'example-extension.zip'),
		xml: path.join(examplePath, 'example-extension.xml')
	};

	t.ok(cfg.zipPath, 'Promised result should have `zipPath` set');
	t.ok(fs.existsSync(cfg.zipPath), `"${cfg.zipPath}" file should exist`);
	t.ok(fs.existsSync(example.zip), `"${example.zip}" file should exist`);
	tryExec(t, `unzip -v ${example.zip}`, `"${example.zip}" file should be a valid ZIP file`);
	tryExec(t, `unzip -v ${cfg.zipPath}`, `"${cfg.zipPath}" file should be a valid ZIP file`);

	t.ok(cfg.crxPath, 'Promised result should have `crxPath` set');
	t.ok(fs.existsSync(cfg.crxPath), `"${cfg.crxPath}" file should exist`);
	t.ok(fs.existsSync(example.crx), `"${example.crx}" file should exist`);

	t.ok(cfg.xmlPath, 'Promised result should have `xmlPath` set');
	t.ok(fs.existsSync(cfg.xmlPath), `"${cfg.xmlPath}" file should exist`);
	t.ok(fs.existsSync(example.xml), `"${example.xml}" file should exist`);

	if (tryExec(t, `diff "${cfg.zipPath}" "${example.zip}"`, `Created "${cfg.zipPath}" should match "${example.zip}"`)) {
		fs.unlinkSync(cfg.zipPath);
	}

	if (tryExec(t, `diff "${cfg.crxPath}" "${example.crx}"`, `Created "${cfg.crxPath}" should match "${example.crx}"`)) {
		fs.unlinkSync(cfg.crxPath);
	}

	if (tryExec(t, `diff "${cfg.xmlPath}" "${example.xml}"`, `Created "${cfg.xmlPath}" should match "${example.xml}"`)) {
		fs.unlinkSync(cfg.xmlPath);
	}

	t.end();
}

function tryExec (t, cmd, msg) {
	try {
		var margin = (new Array(t._objectPrintDepth)).join('.') + ' '; // eslint-disable-line prefer-template,no-underscore-dangle
		var stdout = exec(cmd);
		t.pass(msg);
		if (stdout && stdout.length > 0) {
			t.comment(margin + stdout.toString('utf8').replace(/\n+/g, '\n' + margin)); // eslint-disable-line prefer-template
		}
		return true;
	}
	catch (err) {
		t.error((err.stderr && err.stderr.toString('utf8'))
			|| (err.stdout && err.stdout.toString('utf8'))
			|| err.message, msg);
		return false;
	}
}
