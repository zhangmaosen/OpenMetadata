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

import { Col, Row } from 'antd';
import React, { FC, HTMLAttributes, ReactNode } from 'react';
import './../../styles/layout/page-layout.less';

interface PageLayoutProp extends HTMLAttributes<HTMLDivElement> {
  leftPanel?: ReactNode;
  header?: ReactNode;
  rightPanel?: ReactNode;
}

export const pageContainerStyles = {
  height: '100%',
  padding: '1rem 0.5rem',
  margin: 0,
  overflow: 'hidden',
};

const PageLayoutV1: FC<PageLayoutProp> = ({
  leftPanel,
  children,
  rightPanel,
  className,
}: PageLayoutProp) => {
  return (
    <Row className={className} gutter={[16, 16]} style={pageContainerStyles}>
      {leftPanel && (
        <Col
          className="page-layout-v1-vertical-scroll"
          flex="284px"
          id="left-panelV1">
          {leftPanel}
        </Col>
      )}
      <Col
        className="page-layout-v1-center page-layout-v1-vertical-scroll"
        flex={
          leftPanel && rightPanel
            ? 'calc(100% - 568px)'
            : leftPanel || rightPanel
            ? 'calc(100% - 284px)'
            : '100%'
        }>
        {children}
      </Col>
      {rightPanel && (
        <Col
          className="page-layout-v1-vertical-scroll"
          flex="284px"
          id="right-panelV1">
          {rightPanel}
        </Col>
      )}
    </Row>
  );
};

export default PageLayoutV1;
