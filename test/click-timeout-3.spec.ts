/**
 * Copyright 2018 Google Inc. All rights reserved.
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

import utils from './utils';
const {USES_HOOKS} = testOptions;

it.skip(USES_HOOKS)('should fail when element jumps during hit testing', async({page, server}) => {
  await page.setContent('<button>Click me</button>');
  let clicked = false;
  const handle = await page.$('button');
  const __testHookBeforeHitTarget = () => page.evaluate(() => {
    const margin = parseInt(document.querySelector('button').style.marginLeft || '0') + 100;
    document.querySelector('button').style.marginLeft = margin + 'px';
  });
  const promise = handle.click({ timeout: 5000, __testHookBeforeHitTarget } as any).then(() => clicked = true).catch(e => e);
  const error = await promise;
  expect(clicked).toBe(false);
  expect(await page.evaluate('window.clicked')).toBe(undefined);
  expect(error.message).toContain('elementHandle.click: Timeout 5000ms exceeded.');
  expect(error.message).toContain('element does not receive pointer events');
  expect(error.message).toContain('retrying click action');
});

it('should timeout waiting for hit target', async({page, server}) => {
  await page.goto(server.PREFIX + '/input/button.html');
  const button = await page.$('button');
  await page.evaluate(() => {
    document.body.style.position = 'relative';
    const blocker = document.createElement('div');
    blocker.style.position = 'absolute';
    blocker.style.width = '400px';
    blocker.style.height = '20px';
    blocker.style.left = '0';
    blocker.style.top = '0';
    document.body.appendChild(blocker);
  });
  const error = await button.click({ timeout: 5000 }).catch(e => e);
  expect(error.message).toContain('elementHandle.click: Timeout 5000ms exceeded.');
  expect(error.message).toContain('element does not receive pointer events');
  expect(error.message).toContain('retrying click action');
});
