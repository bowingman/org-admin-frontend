import { RouterTestingModule } from '@angular/router/testing';
import {
  Spectator,
  byText,
  createComponentFactory,
  byPlaceholder,
} from '@ngneat/spectator';
import { StoreModule } from '@ngrx/store';
import { IconDefinition } from '@ant-design/icons-angular';
import { NzIconModule } from 'ng-zorro-antd/icon';
import {
  ExportOutline,
  UserOutline,
  MoreOutline,
  CaretLeftOutline,
} from '@ant-design/icons-angular/icons';
import { reducers, metaReducers } from 'src/app/store/reducers';
import { CommonModule } from '@angular/common';
import { SharedModule } from 'src/app/shared/shared.module';

import { SubPermissionComponent } from './sub-permission.component';

const icons: IconDefinition[] = [
  ExportOutline,
  UserOutline,
  MoreOutline,
  CaretLeftOutline,
];

describe('SubPermissionComponent', () => {
  let spectator: Spectator<SubPermissionComponent>;
  const createComponent = createComponentFactory({
    component: SubPermissionComponent,
    imports: [
      StoreModule.forRoot(reducers, { metaReducers }),
      CommonModule,
      SharedModule,
      NzIconModule.forRoot(icons),
    ],
  });
  const props = {
    title: 'SubPermission title',
    description: 'SubPermission description',
  };

  beforeEach(() => {
    spectator = createComponent({
      props,
    });
    spectator.detectChanges();
  });

  it('should display ui', () => {
    expect(spectator.query(byText(props.title))).toExist();
    expect(spectator.query(byText(props.description))).toExist();
  });
});
