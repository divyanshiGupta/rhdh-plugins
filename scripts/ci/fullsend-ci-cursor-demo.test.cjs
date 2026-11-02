/*
 * Copyright Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const demo = require('./fullsend-ci-cursor-demo.cjs');

test('parses pull request URLs without accepting other GitHub resources', () => {
  assert.deepEqual(
    demo.parsePrUrl(
      'https://github.com/redhat-developer/rhdh-plugins/pull/4471',
    ),
    {
      owner: 'redhat-developer',
      repo: 'rhdh-plugins',
      number: 4471,
      url: 'https://github.com/redhat-developer/rhdh-plugins/pull/4471',
    },
  );
  assert.throws(() =>
    demo.parsePrUrl(
      'https://github.com/redhat-developer/rhdh-plugins/issues/4471',
    ),
  );
});

test('parses local demo options', () => {
  assert.deepEqual(
    demo.parseArgs([
      '--pr',
      'https://github.com/redhat-developer/rhdh-plugins/pull/4471',
      '--run-id',
      '32941039121',
      '--cursor-bin',
      '/tmp/cursor-agent',
      '--repair',
      '--keep',
    ]),
    {
      pr: 'https://github.com/redhat-developer/rhdh-plugins/pull/4471',
      runId: '32941039121',
      cursorBin: '/tmp/cursor-agent',
      repair: true,
      keep: true,
    },
  );
});

test('preserves an explicitly configured Cursor binary', () => {
  assert.equal(demo.resolveCursorBin('/tmp/agent'), '/tmp/agent');
  assert.equal(demo.resolveCursorBin('custom-agent'), 'custom-agent');
});

test('passes only non-sensitive runtime variables to Cursor', () => {
  const environment = demo.buildCursorEnv({
    PATH: '/safe/bin',
    HOME: '/safe/home',
    GH_TOKEN: 'should-not-be-passed',
    GITHUB_TOKEN: 'should-not-be-passed',
    FULLSEND_GCP_PROJECT_ID: 'should-not-be-passed',
    AWS_ACCESS_KEY_ID: 'should-not-be-passed',
    CURSOR_API_KEY: 'should-not-be-passed',
  });
  assert.equal(environment.PATH, '/safe/bin');
  assert.equal(environment.HOME, '/safe/home');
  assert.equal(environment.GH_TOKEN, undefined);
  assert.equal(environment.GITHUB_TOKEN, undefined);
  assert.equal(environment.FULLSEND_GCP_PROJECT_ID, undefined);
  assert.equal(environment.AWS_ACCESS_KEY_ID, undefined);
  assert.equal(environment.CURSOR_API_KEY, undefined);
  assert.equal(environment.GH_PAGER, 'cat');
  assert.equal(environment.PAGER, 'cat');
});

test('extracts the first complete JSON object from Cursor text output', () => {
  assert.deepEqual(
    demo.extractJsonObject(
      'analysis:\n{"status":"blocked","nested":{"ok":true}}\n',
    ),
    {
      status: 'blocked',
      nested: { ok: true },
    },
  );
});

test('formats Cursor progress elapsed time for short and long runs', () => {
  assert.equal(demo.formatElapsed(0), '0s');
  assert.equal(demo.formatElapsed(12_000), '12s');
  assert.equal(demo.formatElapsed(75_000), '1m 15s');
});

test('selects the newest failed CI run at the exact PR head', () => {
  const head = 'a'.repeat(40);
  const selected = demo.selectCiRun(
    [
      {
        id: 1,
        name: 'CI',
        head_sha: head,
        status: 'completed',
        conclusion: 'failure',
        updated_at: '2026-09-04T10:00:00Z',
      },
      {
        id: 2,
        name: 'CI',
        head_sha: head,
        status: 'completed',
        conclusion: 'timed_out',
        updated_at: '2026-09-04T11:00:00Z',
      },
      {
        id: 3,
        name: 'CI',
        head_sha: 'b'.repeat(40),
        status: 'completed',
        conclusion: 'failure',
        updated_at: '2026-09-04T12:00:00Z',
      },
    ],
    undefined,
    head,
  );
  assert.equal(selected.id, 2);
});
