#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import normalize from '@octokit/fixtures/lib/normalize/index.js';
import path from 'path';
import fs from 'fs/promises';

if (import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const argv = yargs(hideBin(process.argv)).argv;

  if (!argv.fixtures) {
    process.exitCode = 1;
    throw new Error('Specify fixtures directory with --fixtures');
  }

  await normalizeFixtures(argv.fixtures);
}

export async function normalizeFixtures(fixtureDirectory) {
  // load recorded fixtures
  const fixtureFiles = (await fs.readdir(fixtureDirectory)).map(f => path.join(process.cwd(), fixtureDirectory, f));
  // fixture contents is an array of objects each containing an array of fixtures
  const fixtureContents = await Promise.all(
    fixtureFiles.map(async file => {
      const fixtureObject = JSON.parse(await fs.readFile(file, { encoding: 'utf-8' }));
      // octokit's normalize function expects request headers to be a flat object, but nock writes them differently.
      // apply fixup
      for (const fixture of fixtureObject) {
        if (fixture.reqheaders) {
          const newheaders = {};
          for (const [k, v] of Object.entries(fixture.reqheaders)) {
            // strip out the authorization header
            newheaders[k] = k === 'authorization' ? 'token ghp_000000000000000000000000000000000000' : v.toString();
          }
          delete fixture.reqheaders;
          fixture.reqheaders = newheaders;
        }
      }
      // need original path to write back
      fixtureObject.original_path = file;
      return fixtureObject;
    })
  ).catch(e => {
    process.exitCode = 1;
    console.error(e);
  });

  // Run octokit's normalization and write back
  if (fixtureContents) {
    await Promise.all(
      fixtureContents.map(async fixture => {
        for (const fixtureKey in fixture) {
          // skip original path, this is just for us
          if (fixtureKey === 'original_path') continue;

          const normalized = await normalize({ commitSha: {}, ids: {} }, fixture[fixtureKey]);
          // while octokit's normalization requires request headers, if we include them our nocks won't match
          delete normalized.reqheaders;
          delete fixture[fixtureKey];
          fixture[fixtureKey] = normalized;
        }
        await fs.writeFile(fixture.original_path, JSON.stringify(fixture, null, 2), { encoding: 'utf-8' });
      })
    );
  }
}
