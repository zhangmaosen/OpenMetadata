/*
 *  Copyright 2022 Collate
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
import { startCase } from 'lodash';
import { ServiceOption, ServicesData, ServiceTypes } from 'Models';
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getServiceByFQN, updateService } from '../../axiosAPIs/serviceAPI';
import ErrorPlaceHolder from '../../components/common/error-with-placeholder/ErrorPlaceHolder';
import TitleBreadcrumb from '../../components/common/title-breadcrumb/title-breadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/title-breadcrumb/title-breadcrumb.interface';
import PageContainerV1 from '../../components/containers/PageContainerV1';
import PageLayout from '../../components/containers/PageLayout';
import Loader from '../../components/Loader/Loader';
import ServiceConfig from '../../components/ServiceConfig/ServiceConfig';
import { GlobalSettingsMenuCategory } from '../../constants/globalSettings.constants';
import { addServiceGuide } from '../../constants/service-guide.constant';
import { OPENMETADATA } from '../../constants/services.const';
import { PageLayoutType } from '../../enums/layout.enum';
import { ServiceCategory } from '../../enums/service.enum';
import { ConfigData, ServicesType } from '../../interface/service.interface';
import jsonData from '../../jsons/en';
import { getEntityMissingError, getEntityName } from '../../utils/CommonUtils';
import { getPathByServiceFQN, getSettingPath } from '../../utils/RouterUtils';
import {
  getServiceRouteFromServiceType,
  serviceTypeLogo,
} from '../../utils/ServiceUtils';
import { showErrorToast } from '../../utils/ToastUtils';

function EditConnectionFormPage() {
  const { serviceFQN, serviceCategory } = useParams() as Record<string, string>;
  const [isLoading, setIsloading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [serviceDetails, setServiceDetails] = useState<ServicesType>();
  const [slashedBreadcrumb, setSlashedBreadcrumb] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);

  const fetchRightPanel = () => {
    const guide = addServiceGuide.find((sGuide) => sGuide.step === 3);

    return (
      guide && (
        <>
          <h6 className="tw-heading tw-text-base">{guide.title}</h6>
          <div className="tw-mb-5">{guide.description}</div>
        </>
      )
    );
  };

  const handleConfigUpdate = (updatedData: ConfigData) => {
    const configData = {
      name: serviceDetails?.name,
      serviceType: serviceDetails?.serviceType,
      description: serviceDetails?.description,
      owner: serviceDetails?.owner,
      connection: {
        config: updatedData,
      },
      // TODO: fix type issue here
    } as unknown as ServiceOption;

    return new Promise<void>((resolve, reject) => {
      updateService(serviceCategory, serviceDetails?.id ?? '', configData)
        .then((res) => {
          if (res) {
            setServiceDetails({
              ...res,
              owner: res?.owner ?? serviceDetails?.owner,
            });
          } else {
            showErrorToast(
              `${jsonData['api-error-messages']['update-service-config-error']}`
            );
          }

          resolve();
        })
        .catch((error: AxiosError) => {
          reject();
          showErrorToast(
            error,
            `${jsonData['api-error-messages']['update-service-config-error']}`
          );
        });
    });
  };

  useEffect(() => {
    setIsloading(true);
    getServiceByFQN(serviceCategory, serviceFQN, ['owner'])
      .then((resService) => {
        if (resService) {
          setServiceDetails(resService);
          setSlashedBreadcrumb([
            {
              name: startCase(serviceCategory),
              url: getSettingPath(
                GlobalSettingsMenuCategory.SERVICES,
                getServiceRouteFromServiceType(serviceCategory as ServiceTypes)
              ),
            },
            {
              name: getEntityName(resService),
              imgSrc: serviceTypeLogo(resService.serviceType),
              url: getPathByServiceFQN(serviceCategory, serviceFQN),
            },
            {
              name: 'Edit Connection',
              url: '',
              activeTitle: true,
            },
          ]);
        } else {
          showErrorToast(jsonData['api-error-messages']['fetch-service-error']);
        }
      })
      .catch((error: AxiosError) => {
        if (error.response?.status === 404) {
          setIsError(true);
        } else {
          showErrorToast(
            error,
            jsonData['api-error-messages']['fetch-service-error']
          );
        }
      })
      .finally(() => {
        setIsloading(false);
      });
  }, [serviceFQN, serviceCategory]);

  const renderPage = () => {
    return isError ? (
      <ErrorPlaceHolder>
        {getEntityMissingError(serviceCategory, serviceFQN)}
      </ErrorPlaceHolder>
    ) : (
      <PageLayout
        classes="tw-max-w-full-hd tw-h-full tw-pt-4"
        header={<TitleBreadcrumb titleLinks={slashedBreadcrumb} />}
        layout={PageLayoutType['2ColRTL']}
        rightPanel={fetchRightPanel()}>
        <div className="tw-form-container">
          <h6 className="tw-heading tw-text-base">
            {`Edit ${serviceFQN} Service Connection`}
          </h6>
          <ServiceConfig
            data={serviceDetails as ServicesData}
            disableTestConnection={
              ServiceCategory.METADATA_SERVICES === serviceCategory &&
              OPENMETADATA === serviceFQN
            }
            handleUpdate={handleConfigUpdate}
            serviceCategory={serviceCategory as ServiceCategory}
            serviceFQN={serviceFQN}
            serviceType={serviceDetails?.serviceType || ''}
          />
        </div>
      </PageLayout>
    );
  };

  return (
    <PageContainerV1>
      <div className="tw-self-center">
        <>{isLoading ? <Loader /> : renderPage()}</>
      </div>
    </PageContainerV1>
  );
}

export default EditConnectionFormPage;
