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

import path from 'path';
import utils from './utils';
const {FFOX, CHROMIUM, WEBKIT, CHANNEL, USES_HOOKS} = testOptions;

it('should work', async ({playwright, page}) => {
  const createTagSelector = () => ({
    create(root, target) {
      return target.nodeName;
    },
    query(root, selector) {
      return root.querySelector(selector);
    },
    queryAll(root, selector) {
      return Array.from(root.querySelectorAll(selector));
    }
  });
  await utils.registerEngine(playwright, 'tag', `(${createTagSelector.toString()})()`);
  await page.setContent('<div><span></span></div><div></div>');
  expect(await (playwright.selectors as any)._createSelector('tag', await page.$('div'))).toBe('DIV');
  expect(await page.$eval('tag=DIV', e => e.nodeName)).toBe('DIV');
  expect(await page.$eval('tag=SPAN', e => e.nodeName)).toBe('SPAN');
  expect(await page.$$eval('tag=DIV', es => es.length)).toBe(2);

  // Selector names are case-sensitive.
  const error = await page.$('tAG=DIV').catch(e => e);
  expect(error.message).toContain('Unknown engine "tAG" while parsing selector tAG=DIV');
});

it('should work with path', async ({playwright, page}) => {
  await utils.registerEngine(playwright, 'foo', { path: path.join(__dirname, 'assets/sectionselectorengine.js') });
  await page.setContent('<section></section>');
  expect(await page.$eval('foo=whatever', e => e.nodeName)).toBe('SECTION');
});

it('should work in main and isolated world', async ({playwright, page}) => {
  const createDummySelector = () => ({
    create(root, target) { },
    query(root, selector) {
      return window['__answer'];
    },
    queryAll(root, selector) {
      return [document.body, document.documentElement, window['__answer']];
    }
  });
  await utils.registerEngine(playwright, 'main', createDummySelector);
  await utils.registerEngine(playwright, 'isolated', createDummySelector, { contentScript: true });
  await page.setContent('<div><span><section></section></span></div>');
  await page.evaluate(() => window['__answer'] = document.querySelector('span'));
  // Works in main if asked.
  expect(await page.$eval('main=ignored', e => e.nodeName)).toBe('SPAN');
  expect(await page.$eval('css=div >> main=ignored', e => e.nodeName)).toBe('SPAN');
  expect(await page.$$eval('main=ignored', es => window['__answer'] !== undefined)).toBe(true);
  expect(await page.$$eval('main=ignored', es => es.filter(e => e).length)).toBe(3);
  // Works in isolated by default.
  expect(await page.$('isolated=ignored')).toBe(null);
  expect(await page.$('css=div >> isolated=ignored')).toBe(null);
  // $$eval always works in main, to avoid adopting nodes one by one.
  expect(await page.$$eval('isolated=ignored', es => window['__answer'] !== undefined)).toBe(true);
  expect(await page.$$eval('isolated=ignored', es => es.filter(e => e).length)).toBe(3);
  // At least one engine in main forces all to be in main.
  expect(await page.$eval('main=ignored >> isolated=ignored', e => e.nodeName)).toBe('SPAN');
  expect(await page.$eval('isolated=ignored >> main=ignored', e => e.nodeName)).toBe('SPAN');
  // Can be chained to css.
  expect(await page.$eval('main=ignored >> css=section', e => e.nodeName)).toBe('SECTION');
});

it('should handle errors', async ({playwright, page}) => {
  let error = await page.$('neverregister=ignored').catch(e => e);
  expect(error.message).toContain('Unknown engine "neverregister" while parsing selector neverregister=ignored');

  const createDummySelector = () => ({
    create(root, target) {
      return target.nodeName;
    },
    query(root, selector) {
      return root.querySelector('dummy');
    },
    queryAll(root, selector) {
      return Array.from(root.querySelectorAll('dummy'));
    }
  });

  error = await playwright.selectors.register('$', createDummySelector).catch(e => e);
  expect(error.message).toBe('Selector engine name may only contain [a-zA-Z0-9_] characters');

  // Selector names are case-sensitive.
  await utils.registerEngine(playwright, 'dummy', createDummySelector);
  await utils.registerEngine(playwright, 'duMMy', createDummySelector);

  error = await playwright.selectors.register('dummy', createDummySelector).catch(e => e);
  expect(error.message).toBe('"dummy" selector engine has been already registered');

  error = await playwright.selectors.register('css', createDummySelector).catch(e => e);
  expect(error.message).toBe('"css" is a predefined selector engine');
});
