/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
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
import './base.fixture';

import path from 'path';
import util from 'util';
import vm from 'vm';
const {FFOX, CHROMIUM, WEBKIT, WIN, USES_HOOKS, CHANNEL} = testOptions;

it('exposeBinding should work', async({browser}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  let bindingSource;
  await page.exposeBinding('add', (source, a, b) => {
    bindingSource = source;
    return a + b;
  });
  const result = await page.evaluate(async function() {
    return window['add'](5, 6);
  });
  expect(bindingSource.context).toBe(context);
  expect(bindingSource.page).toBe(page);
  expect(bindingSource.frame).toBe(page.mainFrame());
  expect(result).toEqual(11);
  await context.close();
});

it('should work', async({page, server}) => {
  await page.exposeFunction('compute', function(a, b) {
    return a * b;
  });
  const result = await page.evaluate(async function() {
    return await window['compute'](9, 4);
  });
  expect(result).toBe(36);
});

it('should work with handles and complex objects', async({page, server}) => {
  const fooHandle = await page.evaluateHandle(() => {
    window['fooValue'] = { bar: 2 };
    return window['fooValue'];
  });
  await page.exposeFunction('handle', () => {
    return [{ foo: fooHandle }];
  });
  const equals = await page.evaluate(async function() {
    const value = await window['handle']();
    const [{ foo }] = value;
    return foo === window['fooValue'];
  });
  expect(equals).toBe(true);
});

it('should throw exception in page context', async({page, server}) => {
  await page.exposeFunction('woof', function() {
    throw new Error('WOOF WOOF');
  });
  const {message, stack} = await page.evaluate(async() => {
    try {
      await window["woof"]();
    } catch (e) {
      return {message: e.message, stack: e.stack};
    }
  });
  expect(message).toBe('WOOF WOOF');
  expect(stack).toContain(__filename);
});

it('should support throwing "null"', async({page, server}) => {
  await page.exposeFunction('woof', function() {
    throw null;
  });
  const thrown = await page.evaluate(async() => {
    try {
      await window["woof"]();
    } catch (e) {
      return e;
    }
  });
  expect(thrown).toBe(null);
});

it('should be callable from-inside addInitScript', async({page, server}) => {
  let called = false;
  await page.exposeFunction('woof', function() {
    called = true;
  });
  await page.addInitScript(() => window["woof"]());
  await page.reload();
  expect(called).toBe(true);
});

it('should survive navigation', async({page, server}) => {
  await page.exposeFunction('compute', function(a, b) {
    return a * b;
  });

  await page.goto(server.EMPTY_PAGE);
  const result = await page.evaluate(async function() {
    return await window['compute'](9, 4);
  });
  expect(result).toBe(36);
});

it('should await returned promise', async({page, server}) => {
  await page.exposeFunction('compute', function(a, b) {
    return Promise.resolve(a * b);
  });

  const result = await page.evaluate(async function() {
    return await window['compute'](3, 5);
  });
  expect(result).toBe(15);
});

it('should work on frames', async({page, server}) => {
  await page.exposeFunction('compute', function(a, b) {
    return Promise.resolve(a * b);
  });

  await page.goto(server.PREFIX + '/frames/nested-frames.html');
  const frame = page.frames()[1];
  const result = await frame.evaluate(async function() {
    return await window['compute'](3, 5);
  });
  expect(result).toBe(15);
});

it('should work on frames before navigation', async({page, server}) => {
  await page.goto(server.PREFIX + '/frames/nested-frames.html');
  await page.exposeFunction('compute', function(a, b) {
    return Promise.resolve(a * b);
  });

  const frame = page.frames()[1];
  const result = await frame.evaluate(async function() {
    return await window['compute'](3, 5);
  });
  expect(result).toBe(15);
});

it('should work after cross origin navigation', async({page, server}) => {
  await page.goto(server.EMPTY_PAGE);
  await page.exposeFunction('compute', function(a, b) {
    return a * b;
  });

  await page.goto(server.CROSS_PROCESS_PREFIX + '/empty.html');
  const result = await page.evaluate(async function() {
    return await window['compute'](9, 4);
  });
  expect(result).toBe(36);
});

it('should work with complex objects', async({page, server}) => {
  await page.exposeFunction('complexObject', function(a, b) {
    return {x: a.x + b.x};
  });
  const result = await page.evaluate(async() => window['complexObject']({x: 5}, {x: 2}));
  expect(result.x).toBe(7);
});
