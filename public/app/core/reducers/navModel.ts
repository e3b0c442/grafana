import { AnyAction, createAction } from '@reduxjs/toolkit';
import { cloneDeep } from 'lodash';

import { NavIndex, NavModel, NavModelItem } from '@grafana/data';
import config from 'app/core/config';

export const HOME_NAV_ID = 'home';

export function buildInitialState(): NavIndex {
  const navIndex: NavIndex = {};
  const rootNodes = cloneDeep(config.bootData.navTree as NavModelItem[]);
  const homeNav = rootNodes.find((node) => node.id === HOME_NAV_ID);

  // set home as parent for the rootNodes
  buildNavIndex(navIndex, rootNodes, homeNav);
  // remove circular parent reference on the home node
  if (navIndex[HOME_NAV_ID]) {
    delete navIndex[HOME_NAV_ID].parentItem;
  }
  return navIndex;
}

function buildNavIndex(navIndex: NavIndex, children: NavModelItem[], parentItem?: NavModelItem) {
  for (const node of children) {
    node.parentItem = parentItem;

    navIndex[node.id!] = node;

    if (node.children) {
      buildNavIndex(navIndex, node.children, node);
    }
  }

  navIndex['not-found'] = { ...buildWarningNav('Page not found', '404 Error').node };
  navIndex['error'] = { ...buildWarningNav('Page error', 'An unexpected error').node };
}

function buildWarningNav(text: string, subTitle?: string): NavModel {
  const node = {
    text,
    subTitle,
    icon: 'exclamation-triangle' as const,
  };
  return {
    node: node,
    main: node,
  };
}

export const initialState: NavIndex = {};

export const updateNavIndex = createAction<NavModelItem>('navIndex/updateNavIndex');
// Since the configuration subtitle includes the organization name, we include this action to update the org name if it changes.
export const updateConfigurationSubtitle = createAction<string>('navIndex/updateConfigurationSubtitle');

export const getItemWithNewSubTitle = (item: NavModelItem, subTitle: string): NavModelItem => ({
  ...item,
  parentItem: {
    ...item.parentItem,
    text: item.parentItem?.text ?? '',
    subTitle,
  },
});

// Redux Toolkit uses ImmerJs as part of their solution to ensure that state objects are not mutated.
// ImmerJs has an autoFreeze option that freezes objects from change which means this reducer can't be migrated to createSlice
// because the state would become frozen and during run time we would get errors because Angular would try to mutate
// the frozen state.
// https://github.com/reduxjs/redux-toolkit/issues/242
export const navIndexReducer = (state: NavIndex = initialState, action: AnyAction): NavIndex => {
  if (updateNavIndex.match(action)) {
    const newPages: NavIndex = {};
    const payload = action.payload;

    for (const node of payload.children!) {
      newPages[node.id!] = {
        ...node,
        parentItem: payload,
      };
    }

    return { ...state, ...newPages };
  } else if (updateConfigurationSubtitle.match(action)) {
    const subTitle = `Organization: ${action.payload}`;

    return {
      ...state,
      cfg: { ...state.cfg, subTitle },
      datasources: getItemWithNewSubTitle(state.datasources, subTitle),
      correlations: getItemWithNewSubTitle(state.correlations, subTitle),
      users: getItemWithNewSubTitle(state.users, subTitle),
      teams: getItemWithNewSubTitle(state.teams, subTitle),
      plugins: getItemWithNewSubTitle(state.plugins, subTitle),
      'org-settings': getItemWithNewSubTitle(state['org-settings'], subTitle),
      apikeys: getItemWithNewSubTitle(state.apikeys, subTitle),
    };
  }

  return state;
};
