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

package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.DASHBOARD;
import static org.openmetadata.service.Entity.FIELD_FOLLOWERS;
import static org.openmetadata.service.Entity.MLMODEL;
import static org.openmetadata.service.Entity.MLMODEL_SERVICE;
import static org.openmetadata.service.util.EntityUtil.entityReferenceMatch;
import static org.openmetadata.service.util.EntityUtil.mlFeatureMatch;
import static org.openmetadata.service.util.EntityUtil.mlHyperParameterMatch;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.schema.entity.services.MlModelService;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MlFeature;
import org.openmetadata.schema.type.MlFeatureSource;
import org.openmetadata.schema.type.MlHyperParameter;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.resources.mlmodels.MlModelResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
public class MlModelRepository extends EntityRepository<MlModel> {
  private static final String MODEL_UPDATE_FIELDS = "owner,dashboard,tags,extension";
  private static final String MODEL_PATCH_FIELDS = "owner,dashboard,tags,extension";

  public MlModelRepository(CollectionDAO dao) {
    super(
        MlModelResource.COLLECTION_PATH,
        Entity.MLMODEL,
        MlModel.class,
        dao.mlModelDAO(),
        dao,
        MODEL_PATCH_FIELDS,
        MODEL_UPDATE_FIELDS);
  }

  @Override
  public void setFullyQualifiedName(MlModel mlModel) {
    mlModel.setFullyQualifiedName(FullyQualifiedName.add(mlModel.getService().getName(), mlModel.getName()));
    if (!nullOrEmpty(mlModel.getMlFeatures())) {
      setMlFeatureFQN(mlModel.getFullyQualifiedName(), mlModel.getMlFeatures());
    }
  }

  @Override
  public MlModel setFields(MlModel mlModel, Fields fields) throws IOException {
    mlModel.setService(getContainer(mlModel.getId()));
    mlModel.setDashboard(fields.contains("dashboard") ? getDashboard(mlModel) : null);
    mlModel.setFollowers(fields.contains(FIELD_FOLLOWERS) ? getFollowers(mlModel) : null);
    mlModel.setUsageSummary(
        fields.contains("usageSummary") ? EntityUtil.getLatestUsage(daoCollection.usageDAO(), mlModel.getId()) : null);
    return mlModel;
  }

  @Override
  public void restorePatchAttributes(MlModel original, MlModel updated) {
    // Patch can't make changes to following fields. Ignore the changes
    updated
        .withFullyQualifiedName(original.getFullyQualifiedName())
        .withService(original.getService())
        .withName(original.getName())
        .withId(original.getId());
  }

  private void setMlFeatureSourcesFQN(List<MlFeatureSource> mlSources) {
    mlSources.forEach(
        s -> {
          if (s.getDataSource() != null) {
            s.setFullyQualifiedName(FullyQualifiedName.add(s.getDataSource().getFullyQualifiedName(), s.getName()));
          } else {
            s.setFullyQualifiedName(s.getName());
          }
        });
  }

  private void setMlFeatureFQN(String parentFQN, List<MlFeature> mlFeatures) {
    mlFeatures.forEach(
        f -> {
          String featureFqn = FullyQualifiedName.add(parentFQN, f.getName());
          f.setFullyQualifiedName(featureFqn);
          if (f.getFeatureSources() != null) {
            setMlFeatureSourcesFQN(f.getFeatureSources());
          }
        });
  }

  /** Make sure that all the MlFeatureSources are pointing to correct EntityReferences in tha Table DAO. */
  private void validateReferences(List<MlFeature> mlFeatures) throws IOException {
    for (MlFeature feature : mlFeatures) {
      if (!nullOrEmpty(feature.getFeatureSources())) {
        for (MlFeatureSource source : feature.getFeatureSources()) {
          validateMlDataSource(source);
        }
      }
    }
  }

  private void validateMlDataSource(MlFeatureSource source) throws IOException {
    if (source.getDataSource() != null) {
      Entity.getEntityReferenceById(
          source.getDataSource().getType(), source.getDataSource().getId(), Include.NON_DELETED);
    }
  }

  @Override
  public void prepare(MlModel mlModel) throws IOException {
    populateService(mlModel);
    setFullyQualifiedName(mlModel);
    if (!nullOrEmpty(mlModel.getMlFeatures())) {
      validateReferences(mlModel.getMlFeatures());
    }

    // Check that the dashboard exists
    if (mlModel.getDashboard() != null) {
      daoCollection.dashboardDAO().findEntityReferenceById(mlModel.getDashboard().getId());
    }
  }

  @Override
  public void storeEntity(MlModel mlModel, boolean update) throws IOException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = mlModel.getOwner();
    List<TagLabel> tags = mlModel.getTags();
    EntityReference dashboard = mlModel.getDashboard();
    EntityReference service = mlModel.getService();

    // Don't store owner, dashboard, href and tags as JSON. Build it on the fly based on relationships
    mlModel.withService(null).withOwner(null).withDashboard(null).withHref(null).withTags(null);

    store(mlModel, update);

    // Restore the relationships
    mlModel.withService(service).withOwner(owner).withDashboard(dashboard).withTags(tags);
  }

  @Override
  public void storeRelationships(MlModel mlModel) {
    EntityReference service = mlModel.getService();
    addRelationship(service.getId(), mlModel.getId(), service.getType(), MLMODEL, Relationship.CONTAINS);

    storeOwner(mlModel, mlModel.getOwner());

    setDashboard(mlModel, mlModel.getDashboard());

    if (mlModel.getDashboard() != null) {
      // Add relationship from MlModel --- uses ---> Dashboard
      addRelationship(
          mlModel.getId(), mlModel.getDashboard().getId(), Entity.MLMODEL, Entity.DASHBOARD, Relationship.USES);
    }

    applyTags(mlModel);
  }

  @Override
  public EntityUpdater getUpdater(MlModel original, MlModel updated, Operation operation) {
    return new MlModelUpdater(original, updated, operation);
  }

  private void populateService(MlModel mlModel) throws IOException {
    MlModelService service = getService(mlModel.getService().getId(), mlModel.getService().getType());
    mlModel.setService(service.getEntityReference());
    mlModel.setServiceType(service.getServiceType());
  }

  private MlModelService getService(UUID serviceId, String entityType) throws IOException {
    if (entityType.equalsIgnoreCase(Entity.MLMODEL_SERVICE)) {
      return daoCollection.mlModelServiceDAO().findEntityById(serviceId);
    }
    throw new IllegalArgumentException(
        CatalogExceptionMessage.invalidServiceEntity(entityType, MLMODEL, MLMODEL_SERVICE));
  }

  private EntityReference getDashboard(MlModel mlModel) throws IOException {
    return mlModel == null ? null : getToEntityRef(mlModel.getId(), Relationship.USES, DASHBOARD, false);
  }

  public void setDashboard(MlModel mlModel, EntityReference dashboard) {
    if (dashboard != null) {
      addRelationship(
          mlModel.getId(), mlModel.getDashboard().getId(), Entity.MLMODEL, Entity.DASHBOARD, Relationship.USES);
    }
  }

  /** Handles entity updated from PUT and POST operation. */
  public class MlModelUpdater extends EntityUpdater {
    public MlModelUpdater(MlModel original, MlModel updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      updateAlgorithm(original, updated);
      updateDashboard(original, updated);
      updateMlFeatures(original, updated);
      updateMlHyperParameters(original, updated);
      updateMlStore(original, updated);
      updateServer(original, updated);
      updateTarget(original, updated);
    }

    private void updateAlgorithm(MlModel origModel, MlModel updatedModel) throws JsonProcessingException {
      // Updating an algorithm should be flagged for an ML Model
      if (recordChange("algorithm", origModel.getAlgorithm(), updatedModel.getAlgorithm())) {
        // Mark the EntityUpdater version change to major
        majorVersionChange = true;
      }
    }

    private void updateMlFeatures(MlModel origModel, MlModel updatedModel) throws JsonProcessingException {
      List<MlFeature> addedList = new ArrayList<>();
      List<MlFeature> deletedList = new ArrayList<>();
      recordListChange(
          "mlFeatures",
          origModel.getMlFeatures(),
          updatedModel.getMlFeatures(),
          addedList,
          deletedList,
          mlFeatureMatch);
    }

    private void updateMlHyperParameters(MlModel origModel, MlModel updatedModel) throws JsonProcessingException {
      List<MlHyperParameter> addedList = new ArrayList<>();
      List<MlHyperParameter> deletedList = new ArrayList<>();
      recordListChange(
          "mlHyperParameters",
          origModel.getMlHyperParameters(),
          updatedModel.getMlHyperParameters(),
          addedList,
          deletedList,
          mlHyperParameterMatch);
    }

    private void updateMlStore(MlModel origModel, MlModel updatedModel) throws JsonProcessingException {
      recordChange("mlStore", origModel.getMlStore(), updatedModel.getMlStore(), true);
    }

    private void updateServer(MlModel origModel, MlModel updatedModel) throws JsonProcessingException {
      // Updating the server can break current integrations to the ML services or enable new integrations
      if (recordChange("server", origModel.getServer(), updatedModel.getServer())) {
        // Mark the EntityUpdater version change to major
        majorVersionChange = true;
      }
    }

    private void updateTarget(MlModel origModel, MlModel updatedModel) throws JsonProcessingException {
      // Updating the target changes the model response
      if (recordChange("target", origModel.getTarget(), updatedModel.getTarget())) {
        majorVersionChange = true;
      }
    }

    private void updateDashboard(MlModel origModel, MlModel updatedModel) throws JsonProcessingException {
      EntityReference origDashboard = origModel.getDashboard();
      EntityReference updatedDashboard = updatedModel.getDashboard();
      if (recordChange("dashboard", origDashboard, updatedDashboard, true, entityReferenceMatch)) {

        // Remove the dashboard associated with the model, if any
        if (origModel.getDashboard() != null) {
          deleteTo(updatedModel.getId(), Entity.MLMODEL, Relationship.USES, Entity.DASHBOARD);
        }

        // Add relationship from model -- uses --> dashboard
        if (updatedDashboard != null) {
          addRelationship(
              updatedModel.getId(), updatedDashboard.getId(), Entity.MLMODEL, Entity.DASHBOARD, Relationship.USES);
        }
      }
    }
  }
}
