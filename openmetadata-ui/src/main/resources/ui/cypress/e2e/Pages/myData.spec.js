/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

/// <reference types="cypress" />

import { interceptURL, searchEntity, verifyResponseStatusCode, visitEntityDetailsPage } from '../../common/common';
import { ENTITIES, FOLLOWING_TITLE, MYDATA_SUMMARY_OPTIONS, MY_DATA_TITLE, NO_SEARCHED_TERMS, RECENT_SEARCH_TITLE, RECENT_VIEW_TITLE, SEARCH_ENTITY_DASHBOARD, SEARCH_ENTITY_PIPELINE, SEARCH_ENTITY_TABLE, SEARCH_ENTITY_TOPIC } from '../../constants/constants';

const tables = Object.values(SEARCH_ENTITY_TABLE);
const topics = Object.values(SEARCH_ENTITY_TOPIC);
const dashboards = Object.values(SEARCH_ENTITY_DASHBOARD);
const pipelines = Object.values(SEARCH_ENTITY_PIPELINE);

describe('MyData page should work', () => {
  beforeEach(() => {
    cy.login()
    interceptURL('GET', '/api/v1/*/name/*', 'getEntityDetails');
    interceptURL('GET', '/api/v1/search/*', 'explorePageSearch');
  });

  const checkRecentlySearchElement = (term) => {
    searchEntity(term, false);
    cy.clickOnLogo();
    cy.get(`[data-testid="search-term-${term}"]`)
      .scrollIntoView()
      .should('be.visible')
      .click();
    cy.get('[data-testid="searchBox"]')
      .invoke('val')
      .then((text) => {
        expect(text).equal(term);
      });
    cy.clickOnLogo();
    cy.get(
      `[data-testid="Recently-Search-${term}"] > :nth-child(1) > .tw-flex > .tw-opacity-0 > [data-testid="image"]`
    )
      .scrollIntoView()
      .invoke('show')
      .click();
    cy.contains(NO_SEARCHED_TERMS).scrollIntoView().should('be.visible');
  };

  const followAndOwnTheEntity = (termObj) => {
    // search for the term and redirect to the respective entity tab

    visitEntityDetailsPage(termObj.term, termObj.serviceName, termObj.entity);

    interceptURL('PUT', '/api/v1/*/*/followers', 'waitAfterFollow');
    cy.get('[data-testid="follow-button"]').should('be.visible').click();

    verifyResponseStatusCode('@waitAfterFollow', 200);
    // go to manage tab and search for logged in user and set the owner
    interceptURL(
      'GET',
      '/api/v1/search/query?q=*%20AND%20teamType:Group&from=0&size=10&index=team_search_index',
      'getTeams'
    );
    cy.get('[data-testid="edit-Owner-icon"]').should('be.visible').click();

    verifyResponseStatusCode('@getTeams', 200);
    //Clicking on users tab
    cy.get('[data-testid="dropdown-tab"]')
      .contains('Users')
      .should('exist')
      .should('be.visible')
      .click();

    //Selecting the user
    cy.get('[data-testid="list-item"]')
      .first()
      .should('exist')
      .should('be.visible')
      .click();

    cy.get(':nth-child(2) > [data-testid="owner-link"]')
      .scrollIntoView()
      .invoke('text')
      .then((text) => {
        expect(text).equal('admin');
      });

    cy.clickOnLogo();

    // checks newly generated feed for follow and setting owner
    cy.get('[data-testid="message-container"]')
      .first()
      .contains('Added owner: admin')
      .should('be.visible');

    cy.get('[data-testid="message-container"]')
      .eq(1)
      .scrollIntoView()
      .contains(`Followed ${termObj.entity.slice(0, -1)}`)
      .should('be.visible');

    cy.clickOnLogo();
  };

  it('MyData Page should render properly with all the required components', () => {
    cy.get('[data-testid="data-summary-container"]').should('be.visible');
    cy.contains(RECENT_SEARCH_TITLE).should('be.visible');
    cy.contains(RECENT_VIEW_TITLE).should('be.visible');
    cy.contains(MY_DATA_TITLE).should('be.visible');
    cy.contains(FOLLOWING_TITLE).should('be.visible');

    Object.values(MYDATA_SUMMARY_OPTIONS).forEach((value) => {
      cy.get(
        `[data-testid="data-summary-container"] [data-testid="${value}-summary"]`
      ).should('be.visible');
    });
  });

  Object.values(ENTITIES).map((entity) => {
    const text = entity.entityObj.displayName ?? entity.entityObj.term
    it(`Recent view section and redirection should work for ${entity.name} entity`, () => {
      visitEntityDetailsPage(
        entity.entityObj.term,
        entity.entityObj.serviceName,
        entity.entityObj.entity
      );
      cy.get('[data-testid="inactive-link"]')
        .invoke('text')
        .then((newText) => {
          expect(newText).equal(text);
        });
      cy.clickOnLogo();
      cy.get(`[data-testid="Recently Viewed-${text}"]`)
        .contains(text)
        .should('be.visible')
        .click();
      cy.get('[data-testid="inactive-link"]')
        .invoke('text')
        .then((newText) => {
          expect(newText).equal(text);
        });
      cy.clickOnLogo();
    });
  });

  it('Listing Recent search terms with redirection should work properly', () => {
    cy.contains(NO_SEARCHED_TERMS).scrollIntoView().should('be.visible');

    checkRecentlySearchElement(SEARCH_ENTITY_TABLE.table_1.term);
    checkRecentlySearchElement(SEARCH_ENTITY_TOPIC.topic_1.term);
    checkRecentlySearchElement(SEARCH_ENTITY_DASHBOARD.dashboard_1.term);
    checkRecentlySearchElement(SEARCH_ENTITY_PIPELINE.pipeline_1.term);
  });

  it('My data, following & feed section should work properly for table entity', () => {
    followAndOwnTheEntity(SEARCH_ENTITY_TABLE.table_1);
  });

  it('My data, following & feed section should work properly for topic entity', () => {
    followAndOwnTheEntity(SEARCH_ENTITY_TOPIC.topic_1);
  });

  it.skip('My data, following & feed section should work properly for dashboard entity', () => {
    followAndOwnTheEntity(SEARCH_ENTITY_DASHBOARD.dashboard_1);
  });

  it('My data, following & feed section should work properly for pipeline entity', () => {
    followAndOwnTheEntity(SEARCH_ENTITY_PIPELINE.pipeline_1);
  });

  it.skip('My data and following section, CTA should work properly', () => {
    const totalCount =
      tables.length + pipelines.length + dashboards.length + topics.length;

    cy.get('[data-testid="my-data-container"] > .ant-card > .ant-card-body')
      .children()
      .should('have.length', 8);
    cy.get(
      '[data-testid="following-data-container"] > .ant-card > .ant-card-body'
    )
      .children()
      .should('have.length', 8);

    cy.get('[data-testid="my-data-total-count"]')
      .invoke('text')
      .then((text) => {
        expect(text).equal(`(${totalCount})`);
      });
    cy.get('[data-testid="following-data-total-count"]')
      .invoke('text')
      .then((text) => {
        expect(text).equal(`(${totalCount})`);
      });

    cy.get('[data-testid="my-data-total-count"]').should('be.visible').click();

    cy.intercept(
      '/api/v1/search/query?q=*&from=0&size=*&sort_field=last_updated_timestamp&sort_order=desc&index=*'
    ).as('searchApi');
    cy.wait('@searchApi');
    cy.get('[data-testid="table-data-card"]').first().should('be.visible');
    cy.clickOnLogo();

    cy.get('[data-testid="following-data-total-count"]')
      .should('be.visible')
      .click();

    cy.wait('@searchApi');
    cy.get('[data-testid="table-data-card"]').first().should('be.visible');
    cy.clickOnLogo();
  });
});
