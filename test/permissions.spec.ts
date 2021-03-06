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

const {FFOX, CHROMIUM, WEBKIT, LINUX, HEADLESS} = testOptions;

function getPermission(page, name) {
  return page.evaluate(name => navigator.permissions.query({name}).then(result => result.state), name);
}

it.skip(WEBKIT)('should be prompt by default', async({page, server, context}) => {
  // Permissions API is not implemented in WebKit (see https://developer.mozilla.org/en-US/docs/Web/API/Permissions_API)
  await page.goto(server.EMPTY_PAGE);
  expect(await getPermission(page, 'geolocation')).toBe('prompt');
});

it.skip(WEBKIT)('should deny permission when not listed', async({page, server, context}) => {
  await page.goto(server.EMPTY_PAGE);
  await context.grantPermissions([], { origin: server.EMPTY_PAGE });
  expect(await getPermission(page, 'geolocation')).toBe('denied');
});

it.skip(WEBKIT)('should fail when bad permission is given', async({page, server, context}) => {
  await page.goto(server.EMPTY_PAGE);
  let error: Error;
  await context.grantPermissions(['foo'], { origin: server.EMPTY_PAGE }).catch(e => error = e);
  expect(error.message).toContain('Unknown permission: foo');
});

it.skip(WEBKIT)('should grant geolocation permission when listed', async({page, server, context}) => {
  await page.goto(server.EMPTY_PAGE);
  await context.grantPermissions(['geolocation'], { origin: server.EMPTY_PAGE });
  expect(await getPermission(page, 'geolocation')).toBe('granted');
});

it.skip(WEBKIT)('should grant notifications permission when listed', async({page, server, context}) => {
  await page.goto(server.EMPTY_PAGE);
  await context.grantPermissions(['notifications'], { origin: server.EMPTY_PAGE });
  expect(await getPermission(page, 'notifications')).toBe('granted');
});

it.skip(WEBKIT)('should accumulate when adding', async({page, server, context}) => {
  await page.goto(server.EMPTY_PAGE);
  await context.grantPermissions(['geolocation']);
  await context.grantPermissions(['notifications']);
  expect(await getPermission(page, 'geolocation')).toBe('granted');
  expect(await getPermission(page, 'notifications')).toBe('granted');
});

it.skip(WEBKIT)('should clear permissions', async({page, server, context}) => {
  await page.goto(server.EMPTY_PAGE);
  await context.grantPermissions(['geolocation']);
  await context.clearPermissions();
  await context.grantPermissions(['notifications']);
  expect(await getPermission(page, 'geolocation')).not.toBe('granted');
  expect(await getPermission(page, 'notifications')).toBe('granted');
});

it.skip(WEBKIT)('should grant permission when listed for all domains', async({page, server, context}) => {
  await page.goto(server.EMPTY_PAGE);
  await context.grantPermissions(['geolocation']);
  expect(await getPermission(page, 'geolocation')).toBe('granted');
});

it.skip(WEBKIT)('should grant permission when creating context', async({server, browser}) => {
  const context = await browser.newContext({ permissions: ['geolocation'] });
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  expect(await getPermission(page, 'geolocation')).toBe('granted');
  await context.close();
});

it.skip(WEBKIT)('should reset permissions', async({page, server, context}) => {
  await page.goto(server.EMPTY_PAGE);
  await context.grantPermissions(['geolocation'], { origin: server.EMPTY_PAGE });
  expect(await getPermission(page, 'geolocation')).toBe('granted');
  await context.clearPermissions();
  expect(await getPermission(page, 'geolocation')).toBe('prompt');
});

it.fail(WEBKIT || FFOX || (CHROMIUM && !HEADLESS))('should trigger permission onchange', async({page, server, context}) => {
  //TODO: flaky
  // - Linux: https://github.com/microsoft/playwright/pull/1790/checks?check_run_id=587327883
  // - Win: https://ci.appveyor.com/project/aslushnikov/playwright/builds/32402536
  await page.goto(server.EMPTY_PAGE);
  await page.evaluate(() => {
    window['events'] = [];
    return navigator.permissions.query({name: 'geolocation'}).then(function(result) {
      window['events'].push(result.state);
      result.onchange = function() {
        window['events'].push(result.state);
      };
    });
  });
  expect(await page.evaluate(() => window['events'])).toEqual(['prompt']);
  await context.grantPermissions([], { origin: server.EMPTY_PAGE });
  expect(await page.evaluate(() => window['events'])).toEqual(['prompt', 'denied']);
  await context.grantPermissions(['geolocation'], { origin: server.EMPTY_PAGE });
  expect(await page.evaluate(() => window['events'])).toEqual(['prompt', 'denied', 'granted']);
  await context.clearPermissions();
  expect(await page.evaluate(() => window['events'])).toEqual(['prompt', 'denied', 'granted', 'prompt']);
});

it.skip(WEBKIT)('should isolate permissions between browser contexts', async({page, server, context, browser}) => {
  await page.goto(server.EMPTY_PAGE);
  const otherContext = await browser.newContext();
  const otherPage = await otherContext.newPage();
  await otherPage.goto(server.EMPTY_PAGE);
  expect(await getPermission(page, 'geolocation')).toBe('prompt');
  expect(await getPermission(otherPage, 'geolocation')).toBe('prompt');

  await context.grantPermissions([], { origin: server.EMPTY_PAGE });
  await otherContext.grantPermissions(['geolocation'], { origin: server.EMPTY_PAGE });
  expect(await getPermission(page, 'geolocation')).toBe('denied');
  expect(await getPermission(otherPage, 'geolocation')).toBe('granted');

  await context.clearPermissions();
  expect(await getPermission(page, 'geolocation')).toBe('prompt');
  expect(await getPermission(otherPage, 'geolocation')).toBe('granted');
  await otherContext.close();
});

it.fail(WEBKIT || FFOX || (CHROMIUM && !HEADLESS))('should support clipboard read', async({page, server, context, browser}) => {
  // No such permissions (requires flag) in Firefox
  await page.goto(server.EMPTY_PAGE);
  expect(await getPermission(page, 'clipboard-read')).toBe('prompt');
  let error;
  await page.evaluate(() => navigator.clipboard.readText()).catch(e => error = e);
  expect(error.toString()).toContain('denied');
  await context.grantPermissions(['clipboard-read']);
  expect(await getPermission(page, 'clipboard-read')).toBe('granted');
  await page.evaluate(() => navigator.clipboard.readText());
});
