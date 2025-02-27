package org.openmetadata.service.resources.dataInsight;

import static javax.ws.rs.core.Response.Status.*;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.assertResponseContains;

import java.io.IOException;
import java.util.Map;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.api.dataInsight.CreateDataInsightChart;
import org.openmetadata.schema.dataInsight.DataInsightChart;
import org.openmetadata.schema.type.DataReportIndex;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;

public class DataInsightResourceTest extends EntityResourceTest<DataInsightChart, CreateDataInsightChart> {
  public DataInsightResourceTest() {
    super(
        Entity.DATA_INSIGHT_CHART,
        DataInsightChart.class,
        DataInsightChartResource.DataInsightChartList.class,
        "dataInsight",
        DataInsightChartResource.FIELDS);
    supportsEmptyDescription = false;
    supportsFollowers = false;
    supportsAuthorizedMetadataOperations = false;
    supportsOwner = false;
  }

  @Test
  void post_data_insight_chart_entity_200(TestInfo test) throws IOException {
    CreateDataInsightChart create = createRequest(test);
    create.withName("dataChartTest");
    DataInsightChart dataInsightChart = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    dataInsightChart = getEntity(dataInsightChart.getId(), ADMIN_AUTH_HEADERS);
    validateCreatedEntity(dataInsightChart, create, ADMIN_AUTH_HEADERS);
  }

  @Test
  void post_data_insight_4x(TestInfo test) throws IOException {
    assertResponseContains(
        () -> createEntity(createRequest(test).withName(null), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "name must not be null");
  }

  @Override
  public CreateDataInsightChart createRequest(String name) {
    return new CreateDataInsightChart()
        .withName(name)
        .withDescription(name)
        .withDataIndexType(DataReportIndex.ENTITY_REPORT_DATA_INDEX);
  }

  @Override
  public void validateCreatedEntity(
      DataInsightChart createdEntity, CreateDataInsightChart request, Map<String, String> authHeaders)
      throws HttpResponseException {
    assertEquals(request.getName(), createdEntity.getName());
    assertEquals(request.getDescription(), createdEntity.getDescription());
  }

  @Override
  public void compareEntities(DataInsightChart expected, DataInsightChart updated, Map<String, String> authHeaders)
      throws HttpResponseException {
    assertEquals(expected.getName(), updated.getName());
    assertEquals(expected.getFullyQualifiedName(), updated.getFullyQualifiedName());
    assertEquals(expected.getDescription(), updated.getDescription());
  }

  @Override
  public DataInsightChart validateGetWithDifferentFields(DataInsightChart entity, boolean byName)
      throws HttpResponseException {
    return null;
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    return;
  }
}
