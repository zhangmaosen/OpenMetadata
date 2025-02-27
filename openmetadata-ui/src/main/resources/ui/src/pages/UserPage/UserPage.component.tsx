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

import { AxiosError } from 'axios';
import { compare, Operation } from 'fast-json-patch';
import { isEmpty, isEqual } from 'lodash';
import { observer } from 'mobx-react';
import { AssetsDataType, FormattedTableData, SearchResponse } from 'Models';
import React, {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useParams } from 'react-router-dom';
import AppState from '../../AppState';
import { useAuthContext } from '../../authentication/auth-provider/AuthProvider';
import { getFeedsWithFilter, postFeedById } from '../../axiosAPIs/feedsAPI';
import { searchData } from '../../axiosAPIs/miscAPI';
import { getUserByName, updateUserDetail } from '../../axiosAPIs/userAPI';
import PageContainerV1 from '../../components/containers/PageContainerV1';
import Loader from '../../components/Loader/Loader';
import Users from '../../components/Users/Users.component';
import { UserDetails } from '../../components/Users/Users.interface';
import { LIST_SIZE } from '../../constants/constants';
import { myDataSearchIndex } from '../../constants/Mydata.constants';
import { getUserCurrentTab } from '../../constants/usersprofile.constants';
import { FeedFilter } from '../../enums/mydata.enum';
import {
  Post,
  Thread,
  ThreadTaskStatus,
  ThreadType,
} from '../../generated/entity/feed/thread';
import { User } from '../../generated/entity/teams/user';
import { Paging } from '../../generated/type/paging';
import { useAuth } from '../../hooks/authHooks';
import { formatDataResponse } from '../../utils/APIUtils';
import { deletePost, updateThreadData } from '../../utils/FeedUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const UserPage = () => {
  const { t } = useTranslation();
  const { username, tab } = useParams<{ [key: string]: string }>();
  const { search } = useLocation();
  const { isAdminUser } = useAuth();
  const { isAuthDisabled } = useAuthContext();
  const searchParams = new URLSearchParams(location.search);
  const [isLoading, setIsLoading] = useState(true);
  const [userData, setUserData] = useState<User>({} as User);
  const [currentLoggedInUser, setCurrentLoggedInUser] = useState<User>();
  const [isError, setIsError] = useState(false);
  const [entityThread, setEntityThread] = useState<Thread[]>([]);
  const [isFeedLoading, setIsFeedLoading] = useState<boolean>(false);
  const [paging, setPaging] = useState<Paging>({} as Paging);
  const [feedFilter, setFeedFilter] = useState<FeedFilter>(
    (searchParams.get('feedFilter') as FeedFilter) ?? FeedFilter.ALL
  );
  const [taskStatus, setTaskStatus] = useState<ThreadTaskStatus>(
    ThreadTaskStatus.Open
  );
  const [followingEntities, setFollowingEntities] = useState<AssetsDataType>({
    data: [],
    total: 0,
    currPage: 1,
  });
  const [ownedEntities, setOwnedEntities] = useState<AssetsDataType>({
    data: [],
    total: 0,
    currPage: 1,
  });

  const threadType = useMemo(() => {
    return getUserCurrentTab(tab) === 2
      ? ThreadType.Task
      : ThreadType.Conversation;
  }, [tab]);

  const isTaskType = isEqual(threadType, ThreadType.Task);

  const fetchUserData = () => {
    setUserData({} as User);
    getUserByName(username, 'profile,roles,teams,follows,owns')
      .then((res) => {
        if (res) {
          setUserData(res);
        } else {
          throw t('server.unexpected-response');
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          t('server.entity-fetch-error', {
            entity: 'User Details',
          })
        );
        setIsError(true);
      })
      .finally(() => setIsLoading(false));
  };

  const fetchEntities = (
    fetchOwnedEntities = false,
    handleEntity: Dispatch<SetStateAction<AssetsDataType>>
  ) => {
    const entity = fetchOwnedEntities ? ownedEntities : followingEntities;
    searchData(
      fetchOwnedEntities
        ? `owner.id:${userData.id}`
        : `followers:${userData.id}`,
      entity.currPage,
      LIST_SIZE,
      ``,
      '',
      '',
      myDataSearchIndex
    )
      .then((res: SearchResponse) => {
        const hits = res?.data?.hits?.hits;
        if (hits?.length > 0) {
          const data = formatDataResponse(hits);
          const total = res.data.hits.total.value;
          handleEntity({
            data,
            total,
            currPage: entity.currPage,
          });
        } else {
          const data = [] as FormattedTableData[];
          const total = 0;
          handleEntity({
            data,
            total,
            currPage: entity.currPage,
          });
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          t('server.entity-fetch-error', {
            entity: `${fetchOwnedEntities ? 'Owned' : 'Follwing'} Entities`,
          })
        );
      });
  };

  const handleFollowingEntityPaginate = (page: string | number) => {
    setFollowingEntities((pre) => ({ ...pre, currPage: page as number }));
  };

  const handleOwnedEntityPaginate = (page: string | number) => {
    setOwnedEntities((pre) => ({ ...pre, currPage: page as number }));
  };

  const ErrorPlaceholder = () => {
    return (
      <div
        className="tw-flex tw-flex-col tw-items-center tw-place-content-center tw-mt-40 tw-gap-1"
        data-testid="error">
        <p className="tw-text-base" data-testid="error-message">
          No user available with name{' '}
          <span className="tw-font-medium" data-testid="username">
            {username}
          </span>{' '}
        </p>
      </div>
    );
  };

  const getFeedData = useCallback(
    (threadType: ThreadType, after?: string, feedFilter?: FeedFilter) => {
      const status = isTaskType ? taskStatus : undefined;
      setIsFeedLoading(true);
      getFeedsWithFilter(
        userData.id,
        feedFilter || FeedFilter.ALL,
        after,
        threadType,
        status
      )
        .then((res) => {
          const { data, paging: pagingObj } = res;
          setPaging(pagingObj);
          setEntityThread((prevData) => {
            if (after) {
              return [...prevData, ...data];
            } else {
              return [...data];
            }
          });
        })
        .catch((err: AxiosError) => {
          showErrorToast(
            err,
            t('server.entity-fetch-error', {
              entity: 'Activity Feeds',
            })
          );
        })
        .finally(() => {
          setIsFeedLoading(false);
        });
    },
    [taskStatus, userData]
  );

  const handleFeedFetchFromFeedList = useCallback(
    (threadType: ThreadType, after?: string, feedFilter?: FeedFilter) => {
      !after && setEntityThread([]);
      getFeedData(threadType, after, feedFilter);
    },
    [getFeedData, setEntityThread, getFeedData]
  );

  const postFeedHandler = (value: string, id: string) => {
    const currentUser = AppState.userDetails?.name ?? AppState.users[0]?.name;

    const data = {
      message: value,
      from: currentUser,
    } as Post;
    postFeedById(id, data)
      .then((res) => {
        if (res) {
          const { id, posts } = res;
          setEntityThread((pre) => {
            return pre.map((thread) => {
              if (thread.id === id) {
                return { ...res, posts: posts?.slice(-3) };
              } else {
                return thread;
              }
            });
          });
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(err, t('message.feed-post-error'));
      });
  };

  const deletePostHandler = (
    threadId: string,
    postId: string,
    isThread: boolean
  ) => {
    deletePost(threadId, postId, isThread, setEntityThread);
  };

  const updateThreadHandler = (
    threadId: string,
    postId: string,
    isThread: boolean,
    data: Operation[]
  ) => {
    updateThreadData(threadId, postId, isThread, data, setEntityThread);
  };

  const updateUserDetails = async (data: UserDetails) => {
    const updatedDetails = { ...userData, ...data };
    const jsonPatch = compare(userData, updatedDetails);

    try {
      const response = await updateUserDetail(userData.id, jsonPatch);
      if (response) {
        setUserData((prevData) => ({ ...prevData, ...response }));
      } else {
        throw t('message.unexpected-error');
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const isLoggedinUser = (userName: string) => {
    return userName === currentLoggedInUser?.name;
  };

  const onSwitchChange = (checked: boolean) => {
    if (checked) {
      setTaskStatus(ThreadTaskStatus.Closed);
    } else {
      setTaskStatus(ThreadTaskStatus.Open);
    }
  };

  const getUserComponent = () => {
    if (!isError && !isEmpty(userData)) {
      return (
        <Users
          deletePostHandler={deletePostHandler}
          feedData={entityThread || []}
          feedFilter={feedFilter}
          fetchFeedHandler={handleFeedFetchFromFeedList}
          followingEntities={followingEntities}
          isAdminUser={Boolean(isAdminUser)}
          isAuthDisabled={Boolean(isAuthDisabled)}
          isFeedLoading={isFeedLoading}
          isLoggedinUser={isLoggedinUser(username)}
          ownedEntities={ownedEntities}
          paging={paging}
          postFeedHandler={postFeedHandler}
          setFeedFilter={setFeedFilter}
          tab={tab}
          threadType={threadType}
          updateThreadHandler={updateThreadHandler}
          updateUserDetails={updateUserDetails}
          userData={userData}
          username={username}
          onFollowingEntityPaginate={handleFollowingEntityPaginate}
          onOwnedEntityPaginate={handleOwnedEntityPaginate}
          onSwitchChange={onSwitchChange}
        />
      );
    } else {
      return <ErrorPlaceholder />;
    }
  };

  useEffect(() => {
    setEntityThread([]);
    fetchUserData();
  }, [username]);

  useEffect(() => {
    if (userData.id) {
      const threadType =
        tab === 'tasks' ? ThreadType.Task : ThreadType.Conversation;

      const newFeedFilter =
        (searchParams.get('feedFilter') as FeedFilter) ??
        (threadType === ThreadType.Conversation
          ? FeedFilter.OWNER
          : FeedFilter.ALL);
      setFeedFilter(newFeedFilter);
      setEntityThread([]);
      getFeedData(threadType, undefined, newFeedFilter);
    }
  }, [userData, tab, search, taskStatus]);

  useEffect(() => {
    setEntityThread([]);
  }, [tab]);

  useEffect(() => {
    if (!isEmpty(userData)) {
      fetchEntities(true, setOwnedEntities);
      fetchEntities(false, setFollowingEntities);
    }
  }, [userData]);

  useEffect(() => {
    fetchEntities(false, setFollowingEntities);
  }, [followingEntities.currPage]);

  useEffect(() => {
    fetchEntities(true, setOwnedEntities);
  }, [ownedEntities.currPage]);

  useEffect(() => {
    setCurrentLoggedInUser(AppState.getCurrentUserDetails());
  }, [AppState.nonSecureUserDetails, AppState.userDetails]);

  return (
    <PageContainerV1>
      {isLoading ? <Loader /> : getUserComponent()}
    </PageContainerV1>
  );
};

export default observer(UserPage);
